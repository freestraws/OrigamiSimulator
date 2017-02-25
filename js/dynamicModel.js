/**
 * Created by ghassaei on 10/7/16.
 */

function initDynamicModel(globals){

    var geometry = new THREE.Geometry();
    geometry.dynamic = true;
    var object3D = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial({shading: THREE.FlatShading, side: THREE.DoubleSide}));
    object3D.visible = globals.dynamicSimVisible;
    globals.threeView.sceneAddModel(object3D);

    var nodes;
    var edges;
    var creases;

    var originalPosition;
    var position;
    var lastPosition;
    var velocity;
    var lastVelocity;
    var externalForces;
    var mass;
    var meta;//[beamsIndex, numBeams, creasesIndex, numCreases]
    var beamMeta;//[K, D, length, otherNodeIndex]

    var normals;
    var creaseMeta;//[k, d, targetTheta, length (to node)]
    var creaseVectors;//vectors of oriented edges in crease
    var theta;//[theta, w, normalIndex1, normalIndex2]
    var lastTheta;//[theta, w, normalIndex1, normalIndex2]

    function syncNodesAndEdges(){
        nodes = globals.model.getNodes();
        edges = globals.model.getEdges();
        //update mesh nodes

        geometry.vertices = [];
        for (var i=0;i<nodes.length;i++){
            geometry.vertices.push(nodes[i].getPosition());
        }
        geometry.faces = [];
        geometry.faces.push(new THREE.Face3(0,1,2));
        geometry.faces.push(new THREE.Face3(0,2,3));
        geometry.computeFaceNormals();

        creases = globals.model.getCreases();

        initTypedArrays();
    }

    var steps;
    var programsInited = false;//flag for initial setup

    var textureDim = 0;
    var textureDimEdges = 0;
    var textureDimFaces = 0;
    var textureDimCreases = 0;
    syncNodesAndEdges();
    initTexturesAndPrograms(globals.gpuMath);
    steps = parseInt(setSolveParams());
    runSolver();

    function reset(){
        globals.gpuMath.step("zeroTexture", [], "u_position");
        globals.gpuMath.step("zeroTexture", [], "u_lastPosition");
        globals.gpuMath.step("zeroTexture", [], "u_velocity");
        globals.gpuMath.step("zeroTexture", [], "u_lastVelocity");

        // for (var i=0;i<creases.length;i++){
        //     lastTheta[i*4] = 0;
        //     lastTheta[i*4+1] = 0;
        // }
    }

    function runSolver(){
        globals.threeView.startAnimation(function(){
            if (!globals.dynamicSimVisible) {
                if (globals.selfWeightMode == "dynamic"){
                    globals.staticModel.setSelfWeight();
                }
                return;
            }
            for (var j=0;j<steps;j++){
                solveStep();
            }
            render();
        });
    }

    function setVisibility(state){
        object3D.visible = state;
        globals.threeView.render();
    }

    function solveStep(){

        if (globals.forceHasChanged){
            updateExternalForces();
            globals.forceHasChanged = false;
        }
        if (globals.fixedHasChanged){
            updateFixed();
            globals.fixedHasChanged = false;
        }
        if (globals.materialHasChanged){
            updateMaterials();
            globals.materialHasChanged = false;
        }
        if (globals.shouldResetDynamicSim){
            reset();
            globals.shouldResetDynamicSim = false;
        }

        var gpuMath = globals.gpuMath;

        gpuMath.setProgram("thetaCalc");
        gpuMath.setSize(textureDimCreases, textureDimCreases);
        gpuMath.step("thetaCalc", ["u_normals", "u_lastTheta", "u_creaseVectors"], "u_theta");

        gpuMath.step("velocityCalc", ["u_lastPosition", "u_lastVelocity", "u_originalPosition", "u_externalForces",
            "u_mass", "u_meta", "u_beamMeta"], "u_velocity");
        gpuMath.step("positionCalc", ["u_velocity", "u_lastPosition", "u_mass"], "u_position");

        gpuMath.swapTextures("u_theta", "u_lastTheta");
        gpuMath.swapTextures("u_velocity", "u_lastVelocity");
        gpuMath.swapTextures("u_position", "u_lastPosition");
    }

    function render(){

        var vectorLength = 1;
        globals.gpuMath.setProgram("packToBytes");
        globals.gpuMath.setUniformForProgram("packToBytes", "u_vectorLength", vectorLength, "1f");
        globals.gpuMath.setSize(textureDim*vectorLength, textureDim);
        globals.gpuMath.step("packToBytes", ["u_theta"], "outputBytes");


        if (globals.gpuMath.readyToRead()) {
            var numPixels = creases.length*vectorLength;
            var height = Math.ceil(numPixels/(textureDimCreases*vectorLength));
            var pixels = new Uint8Array(height*textureDimCreases*4*vectorLength);
            globals.gpuMath.readPixels(0, 0, textureDimCreases * vectorLength, height, pixels);
            var parsedPixels = new Float32Array(pixels.buffer);
            for (var i = 0; i < creases.length; i++) {
                // console.log(parsedPixels[i])
            }
        } else {
            console.log("here");
        }

        var vectorLength = 3;
        globals.gpuMath.setProgram("packToBytes");
        globals.gpuMath.setUniformForProgram("packToBytes", "u_vectorLength", vectorLength, "1f");
        globals.gpuMath.setSize(textureDim*vectorLength, textureDim);
        globals.gpuMath.step("packToBytes", ["u_lastPosition"], "outputBytes");

        if (globals.gpuMath.readyToRead()) {
            var numPixels = nodes.length*vectorLength;
            var height = Math.ceil(numPixels/(textureDim*vectorLength));
            var pixels = new Uint8Array(height*textureDim*4*vectorLength);//todo only grab pixels you need
            globals.gpuMath.readPixels(0, 0, textureDim * vectorLength, height, pixels);
            var parsedPixels = new Float32Array(pixels.buffer);
            for (var i = 0; i < nodes.length; i++) {
                var rgbaIndex = i * vectorLength;
                var nodePosition = new THREE.Vector3(parsedPixels[rgbaIndex], parsedPixels[rgbaIndex + 1], parsedPixels[rgbaIndex + 2]);
                nodes[i].render(nodePosition);
            }
            for (var i=0;i<edges.length;i++){
                edges[i].render();
            }
            geometry.verticesNeedUpdate = true;
            geometry.computeFaceNormals();
            updateNormals();
        } else {
            console.log("here");
        }

        globals.gpuMath.setSize(textureDim, textureDim);
    }

    function setSolveParams(){
        var dt = calcDt();
        var numSteps = 0.5/dt;
        globals.gpuMath.setProgram("velocityCalc");
        globals.gpuMath.setUniformForProgram("velocityCalc", "u_dt", dt, "1f");
        globals.gpuMath.setProgram("positionCalc");
        globals.gpuMath.setUniformForProgram("positionCalc", "u_dt", dt, "1f");
        globals.controls.setDeltaT(dt);
        return numSteps;
    }

    function calcDt(){
        var maxFreqNat = 0;
        _.each(edges, function(beam){
            if (beam.getNaturalFrequency()>maxFreqNat) maxFreqNat = beam.getNaturalFrequency();
        });
        return (1/(2*Math.PI*maxFreqNat))*0.9;//0.9 of max delta t for good measure
    }

    function initTexturesAndPrograms(gpuMath){

        var vertexShader = document.getElementById("vertexShader").text;

        gpuMath.initTextureFromData("u_position", textureDim, textureDim, "FLOAT", position);
        gpuMath.initFrameBufferForTexture("u_position");
        gpuMath.initTextureFromData("u_lastPosition", textureDim, textureDim, "FLOAT", lastPosition);
        gpuMath.initFrameBufferForTexture("u_lastPosition");
        gpuMath.initTextureFromData("u_velocity", textureDim, textureDim, "FLOAT", velocity);
        gpuMath.initFrameBufferForTexture("u_velocity");
        gpuMath.initTextureFromData("u_lastVelocity", textureDim, textureDim, "FLOAT", lastVelocity);
        gpuMath.initFrameBufferForTexture("u_lastVelocity");
        gpuMath.initTextureFromData("u_theta", textureDimCreases, textureDimCreases, "FLOAT", theta);
        gpuMath.initFrameBufferForTexture("u_theta");
        gpuMath.initTextureFromData("u_lastTheta", textureDimCreases, textureDimCreases, "FLOAT", lastTheta);
        gpuMath.initFrameBufferForTexture("u_lastTheta");

        gpuMath.initTextureFromData("u_meta", textureDim, textureDim, "FLOAT", meta);

        gpuMath.createProgram("positionCalc", vertexShader, document.getElementById("positionCalcShader").text);
        gpuMath.setUniformForProgram("positionCalc", "u_velocity", 0, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_lastPosition", 1, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_mass", 2, "1i");
        gpuMath.setUniformForProgram("positionCalc", "u_textureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("velocityCalc", vertexShader, document.getElementById("velocityCalcShader").text);
        gpuMath.setUniformForProgram("velocityCalc", "u_lastPosition", 0, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_lastVelocity", 1, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_originalPosition", 2, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_externalForces", 3, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_mass", 4, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_meta", 5, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_beamMeta", 6, "1i");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDim", [textureDim, textureDim], "2f");
        gpuMath.setUniformForProgram("velocityCalc", "u_textureDimEdges", [textureDimEdges, textureDimEdges], "2f");

        gpuMath.createProgram("thetaCalc", vertexShader, document.getElementById("thetaCalcShader").text);
        gpuMath.setUniformForProgram("thetaCalc", "u_normals", 0, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_lastTheta", 1, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_creaseVectors", 2, "1i");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDimFaces", [textureDimFaces, textureDimFaces], "2f");
        gpuMath.setUniformForProgram("thetaCalc", "u_textureDimCreases", [textureDimCreases, textureDimCreases], "2f");

        gpuMath.createProgram("packToBytes", vertexShader, document.getElementById("packToBytesShader").text);
        gpuMath.initTextureFromData("outputBytes", textureDim*4, textureDim, "UNSIGNED_BYTE", null);
        gpuMath.initFrameBufferForTexture("outputBytes");
        gpuMath.setUniformForProgram("packToBytes", "u_floatTextureDim", [textureDim, textureDim], "2f");

        gpuMath.createProgram("zeroTexture", vertexShader, document.getElementById("zeroTexture").text);

        gpuMath.setSize(textureDim, textureDim);

        programsInited = true;
    }

    function calcTextureSize(numNodes){
        if (numNodes == 1) return 2;
        for (var i=0;i<numNodes;i++){
            if (Math.pow(2, 2*i) >= numNodes){
                return Math.pow(2, i);
            }
        }
        console.warn("no texture size found for " + numCells + " cells");
        return 0;
    }

    function updateMaterials(initing){
        var index = 0;
        for (var i=0;i<nodes.length;i++){
            if (initing) {
                meta[4*i] = index;
                meta[4*i+1] = nodes[i].numBeams();
            }
            for (var j=0;j<nodes[i].beams.length;j++){
                var beam = nodes[i].beams[j];
                beamMeta[4*index] = beam.getK();
                beamMeta[4*index+1] = beam.getD();
                if (initing) {
                    beamMeta[4*index+2] = beam.getLength();
                    beamMeta[4*index+3] = beam.getOtherNode(nodes[i]).getIndex();
                }
                index+=1;
            }
        }
        globals.gpuMath.initTextureFromData("u_beamMeta", textureDimEdges, textureDimEdges, "FLOAT", beamMeta, true);
        //recalc dt
        if (programsInited) setSolveParams();
    }

    function updateExternalForces(){
        for (var i=0;i<nodes.length;i++){
            var externalForce = nodes[i].getExternalForce();
            externalForces[4*i] = externalForce.x;
            externalForces[4*i+1] = externalForce.y;
            externalForces[4*i+2] = externalForce.z;
        }
        globals.gpuMath.initTextureFromData("u_externalForces", textureDim, textureDim, "FLOAT", externalForces, true);
    }

    function updateFixed(){
        for (var i=0;i<nodes.length;i++){
            mass[4*i+1] = (nodes[i].isFixed() ? 1 : 0);
        }
        globals.gpuMath.initTextureFromData("u_mass", textureDim, textureDim, "FLOAT", mass, true);
    }

    function updateOriginalPosition(){
        for (var i=0;i<nodes.length;i++){
            var origPosition = nodes[i].getOriginalPosition();
            originalPosition[4*i] = origPosition.x;
            originalPosition[4*i+1] = origPosition.y;
            originalPosition[4*i+2] = origPosition.z;
        }
        globals.gpuMath.initTextureFromData("u_originalPosition", textureDim, textureDim, "FLOAT", originalPosition, true);
    }

    function updateNormals(){
        var numFaces = geometry.faces.length;
        for (var i=0;i<numFaces;i++){
            var normal = geometry.faces[i].normal;
            normals[i*4] = normal.x;
            normals[i*4+1] = normal.y;
            normals[i*4+2] = normal.z;
        }
        globals.gpuMath.initTextureFromData("u_normals", textureDimFaces, textureDimFaces, "FLOAT", normals, true);
    }

    function updateCreaseVectors(){
        for (var i=0;i<creases.length;i++){
            var rgbaIndex = i*4;
            var vector = creases[i].getVector();
            creaseVectors[rgbaIndex] = vector.x;
            creaseVectors[rgbaIndex+1] = vector.y;
            creaseVectors[rgbaIndex+2] = vector.z;
        }
        globals.gpuMath.initTextureFromData("u_creaseVectors", textureDimCreases, textureDimCreases, "FLOAT", creaseVectors, true);
    }

    function updateCreasesMeta(initing){
        for (var i=0;i<creases.length;i++){
            var crease = creases[i];
            creaseMeta[i*4] = crease.getK();
            creaseMeta[i*4+1] = crease.getD();
            if (initing) creaseMeta[i*4+2] = crease.getTargetTheta();
        }
        globals.gpuMath.initTextureFromData("u_creaseMeta", textureDimCreases, textureDimCreases, "FLOAT", creaseMeta, true);

    }

    function initTypedArrays(){

        textureDim = calcTextureSize(nodes.length);

        var numEdges = 0;
        for (var i=0;i<nodes.length;i++){
            numEdges += nodes[i].numBeams();
        }
        textureDimEdges = calcTextureSize(numEdges);

        var numFaces = geometry.faces.length;
        textureDimFaces = calcTextureSize(numFaces);

        var numCreases = creases.length;
        textureDimCreases = calcTextureSize(numCreases);

        originalPosition = new Float32Array(textureDim*textureDim*4);
        position = new Float32Array(textureDim*textureDim*4);
        lastPosition = new Float32Array(textureDim*textureDim*4);
        velocity = new Float32Array(textureDim*textureDim*4);
        lastVelocity = new Float32Array(textureDim*textureDim*4);
        externalForces = new Float32Array(textureDim*textureDim*4);
        mass = new Float32Array(textureDim*textureDim*4);
        meta = new Float32Array(textureDim*textureDim*4);
        beamMeta = new Float32Array(textureDimEdges*textureDimEdges*4);

        normals = new Float32Array(textureDimFaces*textureDimFaces*4);
        creaseMeta = new Float32Array(textureDimCreases*textureDimCreases*4);
        creaseVectors = new Float32Array(textureDimCreases*textureDimCreases*4);
        theta = new Float32Array(textureDimCreases*textureDimCreases*4);
        lastTheta = new Float32Array(textureDimCreases*textureDimCreases*4);

        for (var i=0;i<textureDim*textureDim;i++){
            mass[4*i+1] = 1;//set all fixed by default
        }

        _.each(nodes, function(node, index){
            mass[4*index] = node.getSimMass();
        });

        for (var i=0;i<textureDimCreases*textureDimCreases;i++){
            if (i >= numCreases){
                lastTheta[i*4+2] = -1;
                lastTheta[i*4+3] = -1;
                continue;
            }
            lastTheta[i*4+2] = creases[i].getNormal1Index();
            lastTheta[i*4+3] = creases[i].getNormal2Index();
        }

        updateOriginalPosition();
        updateMaterials(true);
        updateFixed();
        updateExternalForces();
        updateCreasesMeta(true);
        updateCreaseVectors();
        updateNormals();
    }

    function pause(){
        globals.threeView.pauseAnimation();
    }

    function resume(){
        runSolver();
    }

    return {
        syncNodesAndEdges: syncNodesAndEdges,
        updateOriginalPosition: updateOriginalPosition,
        updateMaterials:updateMaterials,
        reset: reset,
        pause: pause,
        resume: resume,
        setVisibility: setVisibility
    }
}