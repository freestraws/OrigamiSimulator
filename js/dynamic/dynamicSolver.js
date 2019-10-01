/**
 * Created by ghassaei on 10/7/16.
 * nodified by freestraws on 9/29/2019
 */
const shader_dir = "../shaders/"
module.exports = class dynamicSolver{
    constructor(config){
    this.gpuMath = initGPUMath();
    this.config = config
    this.nodes;
    this.edges;
    this.faces;
    this.creases;
    this.positions;
    this.colors;

    this.originalPosition;
    this.position;
    this.lastPosition;
    this.lastLastPosition;//for verlet integration
    this.velocity;
    this.lastVelocity;
    this.externalForces;
    this.mass;
    this.meta;//[beamMetaIndex, numBeams, nodeCreaseMetaIndex, numCreases]
    this.meta2;//[nodeFaceMetaIndex, numFaces]
    this.beamMeta;//[K, D, length, otherNodeIndex]

    this.normals;
    this.faceVertexIndices;//[a,b,c] textureDimFaces
    this.nominalTriangles;//[angleA, angleB, angleC]
    this.nodeFaceMeta;//[faceIndex, a, b, c] textureNodeFaces
    this.creaseMeta;//[k, d, targetTheta, -] textureDimCreases
    this.creaseMeta2;//[node1Index, node2Index, node3index, node4index]//nodes 1 and 2 are opposite crease, 3 and 4 are on crease, textureDimCreases
    this.nodeCreaseMeta;//[creaseIndex (thetaIndex), nodeIndex (1/2/3/4), -, -] textureDimNodeCreases
    this.creaseGeo;//[h1, h2, coef1, coef2]
    this.creaseVectors;//indices of crease nodes
    this.theta;//[theta, w, normalIndex1, normalIndex2]
    this.lastTheta;//[theta, w, normalIndex1, normalIndex2]

    this.programsInited = false;//flag for initial setup

    this.textureDim = 0;
    this.textureDimEdges = 0;
    this.textureDimFaces = 0;
    this.textureDimCreases = 0;
    this.textureDimNodeCreases = 0;
    this.textureDimNodeFaces = 0;
    }

    syncNodesAndEdges(nodes, edges, faces, creases, positions, colors){
        this.nodes = nodes
        this.edges = edges
        this.faces = faces
        this.creases = creases

        this.positions = positions
        this.colors = colors

        this.initTypedArrays();
        this.initTexturesAndPrograms(this.gpuMath);
        this.setSolveParams();
    }

    reset(){
        this.gpuMath.step("zeroTexture", [], "u_position");
        this.gpuMath.step("zeroTexture", [], "u_lastPosition");
        this.gpuMath.step("zeroTexture", [], "u_lastLastPosition");
        this.gpuMath.step("zeroTexture", [], "u_velocity");
        this.gpuMath.step("zeroTexture", [], "u_lastVelocity");
        this.gpuMath.step("zeroThetaTexture", ["u_lastTheta"], "u_theta");
        this.gpuMath.step("zeroThetaTexture", ["u_theta"], "u_lastTheta");
        this.render();
    }

    solve(_numSteps){

        if (this.shouldAnimateFoldPercent){
            globals.creasePercent = globals.videoAnimator.nextFoldAngle(0);
            globals.controls.updateCreasePercent();
            setCreasePercent(globals.creasePercent);
            globals.shouldChangeCreasePercent = true;
        }

        if (globals.forceHasChanged) {
            this.updateExternalForces();
            globals.forceHasChanged = false;
        }
        if (globals.fixedHasChanged) {
            this.updateFixed();
            globals.fixedHasChanged = false;
        }
        if (globals.nodePositionHasChanged) {
            this.updateLastPosition();
            globals.nodePositionHasChanged = false;
        }
        if (globals.creaseMaterialHasChanged) {
            this.updateCreasesMeta();
            globals.creaseMaterialHasChanged = false;
        }
        if (globals.materialHasChanged) {
            this.updateMaterials();
            globals.materialHasChanged = false;
        }
        if (globals.shouldChangeCreasePercent) {
            this.setCreasePercent(globals.creasePercent);
            globals.shouldChangeCreasePercent = false;
        }
        // if (globals.shouldZeroDynamicVelocity){
        //     this.gpuMath.step("zeroTexture", [], "u_velocity");
        //     this.gpuMath.step("zeroTexture", [], "u_lastVelocity");
        //     globals.shouldZeroDynamicVelocity = false;
        // }
        if (globals.shouldCenterGeo){
            var avgPosition = this.getAvgPosition();
            this.gpuMath.setProgram("centerTexture");
            this.gpuMath.setUniformForProgram("centerTexture", "u_center", [avgPosition.x, avgPosition.y, avgPosition.z], "3f");
            this.gpuMath.step("centerTexture", ["u_lastPosition"], "u_position");
            if (this.config.dynamicSolver.integrationType == "verlet") this.gpuMath.step("copyTexture", ["u_position"], "u_lastLastPosition");
            this.gpuMath.swapTextures("u_position", "u_lastPosition");
            this.gpuMath.step("zeroTexture", [], "u_lastVelocity");
            this.gpuMath.step("zeroTexture", [], "u_velocity");
            globals.shouldCenterGeo = false;
        }

        if (_numSteps === undefined) _numSteps = this.config.numSteps;
        for (var j=0;j<_numSteps;j++){
            this.solveStep();
        }
        this.render();
    }

    solveStep(){

        var gpuMath = this.gpuMath;

        gpuMath.setProgram("normalCalc");
        gpuMath.setSize(this.textureDimFaces, this.textureDimFaces);
        gpuMath.step("normalCalc", ["u_faceVertexIndices", "u_lastPosition", "u_originalPosition"], "u_normals");

        gpuMath.setProgram("thetaCalc");
        gpuMath.setSize(this.textureDimCreases, this.textureDimCreases);
        gpuMath.step("thetaCalc", ["u_normals", "u_lastTheta", "u_creaseVectors", "u_lastPosition",
            "u_originalPosition"], "u_theta");

        gpuMath.setProgram("updateCreaseGeo");
        //already at textureDimCreasesxtextureDimCreases
        gpuMath.step("updateCreaseGeo", ["u_lastPosition", "u_originalPosition", "u_creaseMeta2"], "u_creaseGeo");

        if (this.config.dynamicSolver.integrationType == "verlet"){
            gpuMath.setProgram("positionCalcVerlet");
            gpuMath.setSize(this.textureDim, this.textureDim);
            gpuMath.step("positionCalcVerlet", ["u_lastPosition", "u_lastLastPosition", "u_lastVelocity", "u_originalPosition", "u_externalForces",
                "u_mass", "u_meta", "u_beamMeta", "u_creaseMeta", "u_nodeCreaseMeta", "u_normals", "u_theta", "u_creaseGeo",
                "u_meta2", "u_nodeFaceMeta", "u_nominalTriangles"], "u_position");
            gpuMath.step("velocityCalcVerlet", ["u_position", "u_lastPosition", "u_mass"], "u_velocity");
            gpuMath.swapTextures("u_lastPosition", "u_lastLastPosition");
        } else {//euler
            gpuMath.setProgram("velocityCalc");
            gpuMath.setSize(this.textureDim, this.textureDim);
            gpuMath.step("velocityCalc", ["u_lastPosition", "u_lastVelocity", "u_originalPosition", "u_externalForces",
                "u_mass", "u_meta", "u_beamMeta", "u_creaseMeta", "u_nodeCreaseMeta", "u_normals", "u_theta", "u_creaseGeo",
                "u_meta2", "u_nodeFaceMeta", "u_nominalTriangles"], "u_velocity");
            gpuMath.step("positionCalc", ["u_velocity", "u_lastPosition", "u_mass"], "u_position");
        }

        gpuMath.swapTextures("u_theta", "u_lastTheta");
        gpuMath.swapTextures("u_velocity", "u_lastVelocity");
        gpuMath.swapTextures("u_position", "u_lastPosition");
    }

    getAvgPosition(){
        var xavg = 0;
        var yavg = 0;
        var zavg = 0;
        for (var i=0;i<this.positions.length;i+=3){
            xavg += this.positions[i];
            yavg += this.positions[i+1];
            zavg += this.positions[i+2];
        }
        var avgPosition = new THREE.Vector3(xavg, yavg, zavg);
        avgPosition.multiplyScalar(3/this.positions.length);
        return avgPosition;
    }

    render(){

        var vectorLength = 4;
        this.gpuMath.setProgram("packToBytes");
        this.gpuMath.setUniformForProgram("packToBytes", "u_vectorLength", vectorLength, "1f");
        this.gpuMath.setUniformForProgram("packToBytes", "u_floatTextureDim", [this.textureDim, this.textureDim], "2f");
        this.gpuMath.setSize(this.textureDim*vectorLength, this.textureDim);
        this.gpuMath.step("packToBytes", ["u_lastPosition"], "outputBytes");

        if (this.gpuMath.readyToRead()) {
            var numPixels = this.nodes.length*vectorLength;
            var height = Math.ceil(numPixels/(this.textureDim*vectorLength));
            var pixels = new Uint8Array(height*this.textureDim*4*vectorLength);
            this.gpuMath.readPixels(0, 0, this.textureDim * vectorLength, height, pixels);
            var parsedPixels = new Float32Array(pixels.buffer);
            var globalError = 0;
            var shouldUpdateColors = config.view.colorMode == "axialStrain";
            for (var i = 0; i < this.nodes.length; i++) {
                var rgbaIndex = i * vectorLength;
                var nodeError = parsedPixels[rgbaIndex+3]*100;
                globalError += nodeError;
                var nodePosition = new THREE.Vector3(parsedPixels[rgbaIndex], parsedPixels[rgbaIndex + 1], parsedPixels[rgbaIndex + 2]);
                nodePosition.add(nodes[i]._originalPosition);
                this.positions[3*i] = nodePosition.x;
                this.positions[3*i+1] = nodePosition.y;
                this.positions[3*i+2] = nodePosition.z;
                if (shouldUpdateColors){
                    if (nodeError>this.config.strainClip) nodeError = this.config.strainClip;
                    var scaledVal = (1-nodeError/this.config.strainClip) * 0.7;
                    var color = new THREE.Color();
                    color.setHSL(scaledVal, 1, 0.5);
                    this.colors[3*i] = color.r;
                    this.colors[3*i+1] = color.g;
                    this.colors[3*i+2] = color.b;
                }
            }
            console.err((globalError/this.nodes.length).toFixed(7) + " %");
            // $errorOutput.html((globalError/nodes.length).toFixed(7) + " %");
        } else {
            console.log("shouldn't be here");
        }
    }

    setSolveParams(){
        var dt = this.calcDt();
        // $("#deltaT").html(dt);
        this.gpuMath.setProgram("thetaCalc");
        this.gpuMath.setUniformForProgram("thetaCalc", "u_dt", dt, "1f");
        this.gpuMath.setProgram("velocityCalc");
        this.gpuMath.setUniformForProgram("velocityCalc", "u_dt", dt, "1f");
        this.gpuMath.setProgram("positionCalcVerlet");
        this.gpuMath.setUniformForProgram("positionCalcVerlet", "u_dt", dt, "1f");
        this.gpuMath.setProgram("positionCalc");
        this.gpuMath.setUniformForProgram("positionCalc", "u_dt", dt, "1f");
        this.gpuMath.setProgram("velocityCalcVerlet");
        this.gpuMath.setUniformForProgram("velocityCalcVerlet", "u_dt", dt, "1f");
        globals.controls.setDeltaT(dt);
    }

    calcDt(){
        var maxFreqNat = 0;
        _.each(this.edges, function(beam){
            if (beam.getNaturalFrequency()>maxFreqNat) maxFreqNat = beam.getNaturalFrequency();
        });
        return (1/(2*Math.PI*maxFreqNat))*0.9;//0.9 of max delta t for good measure
    }

    initTexturesAndPrograms(gpuMath){

        var vertexShader = fs.open("vertexShader").text;

        gpuMath.initTextureFromData("u_position", textureDim, textureDim, "FLOAT", position, true);
        gpuMath.initTextureFromData("u_lastPosition", textureDim, textureDim, "FLOAT", lastPosition, true);
        gpuMath.initTextureFromData("u_lastLastPosition", textureDim, textureDim, "FLOAT", lastLastPosition, true);
        gpuMath.initTextureFromData("u_velocity", textureDim, textureDim, "FLOAT", velocity, true);
        gpuMath.initTextureFromData("u_lastVelocity", textureDim, textureDim, "FLOAT", lastVelocity, true);
        gpuMath.initTextureFromData("u_theta", textureDimCreases, textureDimCreases, "FLOAT", theta, true);
        gpuMath.initTextureFromData("u_lastTheta", textureDimCreases, textureDimCreases, "FLOAT", lastTheta, true);
        gpuMath.initTextureFromData("u_normals", textureDimFaces, textureDimFaces, "FLOAT", normals, true);

        gpuMath.initFrameBufferForTexture("u_position", true);
        gpuMath.initFrameBufferForTexture("u_lastPosition", true);
        gpuMath.initFrameBufferForTexture("u_lastLastPosition", true);
        gpuMath.initFrameBufferForTexture("u_velocity", true);
        gpuMath.initFrameBufferForTexture("u_lastVelocity", true);
        gpuMath.initFrameBufferForTexture("u_theta", true);
        gpuMath.initFrameBufferForTexture("u_lastTheta", true);
        gpuMath.initFrameBufferForTexture("u_normals", true);

        gpuMath.initTextureFromData("u_meta", textureDim, textureDim, "FLOAT", meta, true);
        gpuMath.initTextureFromData("u_meta2", textureDim, textureDim, "FLOAT", meta2, true);
        gpuMath.initTextureFromData("u_nominalTrinagles", textureDimFaces, textureDimFaces, "FLOAT", nominalTriangles, true);
        gpuMath.initTextureFromData("u_nodeCreaseMeta", textureDimNodeCreases, textureDimNodeCreases, "FLOAT", nodeCreaseMeta, true);
        gpuMath.initTextureFromData("u_creaseMeta2", textureDimCreases, textureDimCreases, "FLOAT", creaseMeta2, true);
        gpuMath.initTextureFromData("u_nodeFaceMeta", textureDimNodeFaces, textureDimNodeFaces, "FLOAT", nodeFaceMeta, true);
        gpuMath.initTextureFromData("u_creaseGeo", textureDimCreases, textureDimCreases, "FLOAT", creaseGeo, true);
        gpuMath.initFrameBufferForTexture("u_creaseGeo", true);
        gpuMath.initTextureFromData("u_faceVertexIndices", textureDimFaces, textureDimFaces, "FLOAT", faceVertexIndices, true);
        gpuMath.initTextureFromData("u_nominalTriangles", textureDimFaces, textureDimFaces, "FLOAT", nominalTriangles, true);

        gpuMath.createProgram("positionCalc", vertexShader, fs.open("positionCalcShader"));
        gpuMath.setUniformForProgram("positionCalc", "u_velocity", 0, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_mass", 2, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("velocityCalcVerlet", vertexShader, fs.open("velocityCalcVerletShader"));
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_position", 0, "1i");
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_mass", 2, "1i");
        gpuMath.setUniformForProgram("velocityCalcVerlet", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("velocityCalc", vertexShader, fs.open("velocityCalcShader"));
        gpuMath.setUniformForProgram("velocityCalc", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_lastVelocity", 1, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_originalPosition", 2, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_externalForces", 3, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_mass", 4, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_meta", 5, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_beamMeta", 6, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_creaseMeta", 7, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_nodeCreaseMeta", 8, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_normals", 9, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_theta", 10, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_creaseGeo", 11, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_meta2", 12, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_nodeFaceMeta", 13, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_nominalTriangles", 14, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimEdges", [textureDimEdges, textureDimEdges], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimNodeCreases", [textureDimNodeCreases, textureDimNodeCreases], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimNodeFaces", [textureDimNodeFaces, textureDimNodeFaces], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_creasePercent", globals.creasePercent, "1f");
        gpuMath.setUniformForProgram("velocityCalc", "u_axialStiffness", globals.axialStiffness, "1f");
        gpuMath.setUniformForProgram("velocityCalc", "u_faceStiffness", globals.faceStiffness, "1f");
        gpuMath.setUniformForProgram("velocityCalc", "u_calcFaceStrain", globals.calcFaceStrain, "1f");

        gpuMath.createProgram("positionCalcVerlet", vertexShader, fs.open("positionCalcVerletShader"));
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_lastLastPosition", 1, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_lastVelocity", 2, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_originalPosition", 3, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_externalForces", 4, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_mass", 5, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_meta", 6, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_beamMeta", 7, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_creaseMeta", 8, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_nodeCreaseMeta", 9, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_normals", 10, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_theta", 11, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_creaseGeo", 12, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_meta2", 13, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_nodeFaceMeta", 14, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_nominalTriangles", 15, "1i");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimEdges", [textureDimEdges, textureDimEdges], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimNodeCreases", [textureDimNodeCreases, textureDimNodeCreases], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_textureDimNodeFaces", [textureDimNodeFaces, textureDimNodeFaces], "2f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_creasePercent", globals.creasePercent, "1f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_axialStiffness", this.config.compliant_sim.axialStiffness, "1f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_faceStiffness", this.config.compliant_sim.faceStiffness, "1f");
        gpuMath.setUniformForProgram("positionCalcVerlet", "u_calcFaceStrain", this.config.compliant_sim.calcFaceStrain, "1f");

        gpuMath.createProgram("thetaCalc", vertexShader, fs.open("thetaCalcShader"));
        gpuMath.setUniformForProgram("thetaCalc", "u_normals", 0, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_lastTheta", 1, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_creaseVectors", 2, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_lastPosition", 3, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_originalPosition", 4, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.createProgram("normalCalc", vertexShader, fs.open("normalCalc"));
        gpuMath.setUniformForProgram("normalCalc", "u_faceVertexIndices", 0, "1i");
        gpuMath.setUniformForProgram("normalCalc", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("normalCalc", "u_originalPosition", 2, "1i");
        gpuMath.setUniformForProgram("normalCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("normalCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");

        gpuMath.createProgram("packToBytes", vertexShader, fs.open("packToBytesShader"));
        gpuMath.initTextureFromData("outputBytes", textureDim*4, textureDim, "UNSIGNED_BYTE", null, true);
        gpuMath.initFrameBufferForTexture("outputBytes", true);
        gpuMath.setUniformForProgram("packToBytes", "u_floatTextureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("packToBytes", "u_floatTexture", 0, "1i");

        gpuMath.createProgram("zeroTexture", vertexShader, fs.open("zeroTexture"));
        gpuMath.createProgram("zeroThetaTexture", vertexShader, fs.open("zeroThetaTexture"));
        gpuMath.setUniformForProgram("zeroThetaTexture", "u_theta", 0, "1i");
        gpuMath.setUniformForProgram("zeroThetaTexture", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.createProgram("centerTexture", vertexShader, fs.open("centerTexture"));
        gpuMath.setUniformForProgram("centerTexture", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("centerTexture", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("copyTexture", vertexShader, fs.open("copyTexture"));
        gpuMath.setUniformForProgram("copyTexture", "u_orig", 0, "1i");
        gpuMath.setUniformForProgram("copyTexture", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("updateCreaseGeo", vertexShader, fs.open("updateCreaseGeo"));
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_originalPosition", 1, "1i");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_creaseMeta2", 2, "1i");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("updateCreaseGeo", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.setSize(this.textureDim, this.textureDim);

        this.programsInited = true;
    }

    calcTextureSize(numNodes){
        if (numNodes == 1) return 2;
        for (var i=0;i<numNodes;i++){
            if (Math.pow(2, 2*i) >= numNodes){
                return Math.pow(2, i);
            }
        }
        console.warn("no texture size found for " + numNodes + " items");
        return 2;
    }

    updateMaterials(initing){
        var index = 0;
        for (var i=0;i<this.nodes.length;i++){
            if (initing) {
                this.meta[4*i] = index;
                this.meta[4*i+1] = this.nodes[i].numBeams();
            }
            for (var j=0;j<this.nodes[i].beams.length;j++){
                var beam = this.nodes[i].beams[j];
                beamMeta[4*index] = beam.getK();
                beamMeta[4*index+1] = beam.getD();
                if (initing) {
                    beamMeta[4*index+2] = beam.getLength();
                    beamMeta[4*index+3] = beam.getOtherNode(nodes[i]).getIndex();
                }
                index+=1;
            }
        }
        this.gpuMath.initTextureFromData("u_beamMeta", this.textureDimEdges, this.textureDimEdges, "FLOAT", beamMeta, true);


        if (this.programsInited) {
            this.gpuMath.setProgram("velocityCalc");
            this.gpuMath.setUniformForProgram("velocityCalc", "u_axialStiffness", config.compliant_sim.axialStiffness, "1f");
            this.gpuMath.setUniformForProgram("velocityCalc", "u_faceStiffness", config.compliant_sim.faceStiffness, "1f");
            this.gpuMath.setProgram("positionCalcVerlet");
            this.gpuMath.setUniformForProgram("positionCalcVerlet", "u_axialStiffness", config.compliant_sim.axialStiffness, "1f");
            this.gpuMath.setUniformForProgram("positionCalcVerlet", "u_faceStiffness", config.compliant_sim.faceStiffness, "1f");
            this.setSolveParams();//recalc dt
        }
    }

    updateExternalForces(){
        for (var i=0;i<this.nodes.length;i++){
            var externalForce = this.nodes[i].getExternalForce();
            externalForces[4*i] = externalForce.x;
            externalForces[4*i+1] = externalForce.y;
            externalForces[4*i+2] = externalForce.z;
        }
        this.gpuMath.initTextureFromData("u_externalForces", this.textureDim, this.textureDim, "FLOAT", externalForces, true);
    }

    updateFixed(){
        for (var i=0;i<this.nodes.length;i++){
            this.mass[4*i+1] = (this.nodes[i].isFixed() ? 1 : 0);
        }
        this.gpuMath.initTextureFromData("u_mass", this.textureDim, this.textureDim, "FLOAT", this.mass, true);
    }

    updateOriginalPosition(){
        for (var i=0;i<this.nodes.length;i++){
            var origPosition = this.nodes[i].getOriginalPosition();
            originalPosition[4*i] = origPosition.x;
            originalPosition[4*i+1] = origPosition.y;
            originalPosition[4*i+2] = origPosition.z;
        }
        this.gpuMath.initTextureFromData("u_originalPosition", this.textureDim, this.textureDim, "FLOAT", originalPosition, true);
    }

    updateCreaseVectors(){
        for (var i=0;i<this.creases.length;i++){
            var rgbaIndex = i*4;
            var nodes = this.creases[i].edge.nodes;
            // this.vertices[1].clone().sub(this.vertices[0]);
            this.creaseVectors[rgbaIndex] = nodes[0].getIndex();
            this.creaseVectors[rgbaIndex+1] = nodes[1].getIndex();
        }
        this.gpuMath.initTextureFromData("u_creaseVectors", this.textureDimCreases, this.textureDimCreases, "FLOAT", this.creaseVectors, true);
    }

    updateCreasesMeta(initing){
        for (var i=0;i<this.creases.length;i++){
            var crease = this.creases[i];
            this.creaseMeta[i*4] = crease.getK();
            // creaseMeta[i*4+1] = crease.getD();
            if (initing) this.creaseMeta[i*4+2] = crease.getTargetTheta();
        }
        this.gpuMath.initTextureFromData("u_creaseMeta", this.textureDimCreases, this.textureDimCreases, "FLOAT", creaseMeta, true);
    }

    updateLastPosition(){
        for (var i=0;i<this.nodes.length;i++){
            var _position = this.nodes[i].getRelativePosition();
            this.lastPosition[4*i] = _position.x;
            this.lastPosition[4*i+1] = _position.y;
            this.lastPosition[4*i+2] = _position.z;
        }
        this.gpuMath.initTextureFromData("u_lastPosition", this.textureDim, this.textureDim, "FLOAT", this.lastPosition, true);
        this.gpuMath.initFrameBufferForTexture("u_lastPosition", true);

    }

    setCreasePercent(percent){
        if (!this.programsInited) return;
        this.gpuMath.setProgram("velocityCalc");
        this.gpuMath.setUniformForProgram("velocityCalc", "u_creasePercent", percent, "1f");
        this.gpuMath.setProgram("positionCalcVerlet");
        this.gpuMath.setUniformForProgram("positionCalcVerlet", "u_creasePercent", percent, "1f");
    }

    initTypedArrays(){

        this.textureDim = this.calcTextureSize(this.nodes.length);

        var numNodeFaces = 0;
        var nodeFaces = [];
        for (var i=0;i<this.nodes.length;i++){
            nodeFaces.push([]);
            for (var j=0;j<this.faces.length;j++){
                if (this.faces[j].indexOf(i)>=0) {
                    nodeFaces[i].push(j);
                    numNodeFaces++;
                }
            }
        }
        this.textureDimNodeFaces = this.calcTextureSize(numNodeFaces);

        var numEdges = 0;
        for (var i=0;i<this.nodes.length;i++){
            numEdges += this.nodes[i].numBeams();
        }
        this.textureDimEdges = this.calcTextureSize(numEdges);

        var numCreases = this.creases.length;
        this.textureDimCreases = this.calcTextureSize(numCreases);

        var numNodeCreases = 0;
        for (var i=0;i<this.nodes.length;i++){
            numNodeCreases += this.nodes[i].numCreases();
        }
        numNodeCreases += numCreases*2;//reactions
        this.textureDimNodeCreases = this.calcTextureSize(numNodeCreases);

        var numFaces = this.faces.length;
        this.textureDimFaces = this.calcTextureSize(numFaces);

        this.originalPosition = new Float32Array(textureDim*textureDim*4);
        this.position = new Float32Array(textureDim*textureDim*4);
        this.lastPosition = new Float32Array(textureDim*textureDim*4);
        this.lastLastPosition = new Float32Array(textureDim*textureDim*4);
        this.velocity = new Float32Array(textureDim*textureDim*4);
        this.lastVelocity = new Float32Array(textureDim*textureDim*4);
        this.externalForces = new Float32Array(textureDim*textureDim*4);
        this.mass = new Float32Array(textureDim*textureDim*4);
        this.meta = new Float32Array(textureDim*textureDim*4);
        this.meta2 = new Float32Array(textureDim*textureDim*4);
        this.beamMeta = new Float32Array(textureDimEdges*textureDimEdges*4);

        this.normals = new Float32Array(textureDimFaces*textureDimFaces*4);
        this.faceVertexIndices = new Float32Array(textureDimFaces*textureDimFaces*4);
        this.creaseMeta = new Float32Array(textureDimCreases*textureDimCreases*4);
        this.nodeFaceMeta = new Float32Array(textureDimNodeFaces*textureDimNodeFaces*4);
        this.nominalTriangles = new Float32Array(textureDimFaces*textureDimFaces*4);
        this.nodeCreaseMeta = new Float32Array(textureDimNodeCreases*textureDimNodeCreases*4);
        this.creaseMeta2 = new Float32Array(textureDimCreases*textureDimCreases*4);
        this.creaseGeo = new Float32Array(textureDimCreases*textureDimCreases*4);
        this.creaseVectors = new Float32Array(textureDimCreases*textureDimCreases*4);
        this.theta = new Float32Array(textureDimCreases*textureDimCreases*4);
        this.lastTheta = new Float32Array(textureDimCreases*textureDimCreases*4);

        for (var i=0;i<this.faces.length;i++){
            var face = this.faces[i];
            this.faceVertexIndices[4*i] = face[0];
            this.faceVertexIndices[4*i+1] = face[1];
            this.faceVertexIndices[4*i+2] = face[2];

            var a = this.nodes[face[0]].getOriginalPosition();
            var b = this.nodes[face[1]].getOriginalPosition();
            var c = this.nodes[face[2]].getOriginalPosition();
            var ab = (b.clone().sub(a)).normalize();
            var ac = (c.clone().sub(a)).normalize();
            var bc = (c.clone().sub(b)).normalize();
            this.nominalTriangles[4*i] = Math.acos(ab.dot(ac));
            this.nominalTriangles[4*i+1] = Math.acos(-1*ab.dot(bc));
            this.nominalTriangles[4*i+2] = Math.acos(ac.dot(bc));

            if (Math.abs(this.nominalTriangles[4*i]+this.nominalTriangles[4*i+1]+this.nominalTriangles[4*i+2]-Math.PI)>0.1){
                console.warn("bad angles");
            }
        }


        for (var i=0;i<this.textureDim*this.textureDim;i++){
            this.mass[4*i+1] = 1;//set all fixed by default
        }

        for (var i=0;i<this.textureDimCreases*this.textureDimCreases;i++){
            if (i >= numCreases){
                this.lastTheta[i*4+2] = -1;
                this.lastTheta[i*4+3] = -1;
                continue;
            }
            this.lastTheta[i*4+2] = this.creases[i].getNormal1Index();
            this.lastTheta[i*4+3] = this.creases[i].getNormal2Index();
        }

        var index = 0;
        for (var i=0;i<this.nodes.length;i++){
            this.meta2[4*i] = index;
            var num = nodeFaces[i].length;
            this.meta2[4*i+1] = num;
            for (var j=0;j<num;j++){
                var _index = (index+j)*4;
                var face = this.faces[nodeFaces[i][j]];
                this.nodeFaceMeta[_index] = nodeFaces[i][j];
                this.nodeFaceMeta[_index+1] = face[0] == i ? -1 : face[0];
                this.nodeFaceMeta[_index+2] = face[1] == i ? -1 : face[1];
                this.nodeFaceMeta[_index+3] = face[2] == i ? -1 : face[2];
            }
            index+=num;
        }

        var index = 0;
        for (var i=0;i<this.nodes.length;i++){
            this.mass[4*i] = this.nodes[i].getSimMass();
            this.meta[i*4+2] = index;
            var nodeCreases = this.nodes[i].creases;
            var nodeInvCreases = this.nodes[i].invCreases;//nodes attached to crease move in opposite direction
            // console.log(nodeInvCreases);
            this.meta[i*4+3] = nodeCreases.length + nodeInvCreases.length;
            for (var j=0;j<nodeCreases.length;j++){
                this.nodeCreaseMeta[index*4] = nodeCreases[j].getIndex();
                this.nodeCreaseMeta[index*4+1] = nodeCreases[j].getNodeIndex(this.nodes[i]);//type 1, 2, 3, 4
                index++;
            }
            for (var j=0;j<nodeInvCreases.length;j++){
                this.nodeCreaseMeta[index*4] = nodeInvCreases[j].getIndex();
                this.nodeCreaseMeta[index*4+1] = nodeInvCreases[j].getNodeIndex(this.nodes[i]);//type 1, 2, 3, 4
                index++;
            }
        }
        for (var i=0;i<this.creases.length;i++){
            var crease = this.creases[i];
            this.creaseMeta2[i*4] = crease.node1.getIndex();
            this.creaseMeta2[i*4+1] = crease.node2.getIndex();
            this.creaseMeta2[i*4+2] = crease.edge.nodes[0].getIndex();
            this.creaseMeta2[i*4+3] = crease.edge.nodes[1].getIndex();
            index++;
        }

        this.updateOriginalPosition();
        this.updateMaterials(true);
        this.updateFixed();
        this.updateExternalForces();
        this.updateCreasesMeta(true);
        this.updateCreaseVectors();
        this.setCreasePercent(globals.creasePercent);
    }

}
