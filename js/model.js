/**
 * Created by amandaghassaei on 2/24/17.
 * nodified by freestraws on 9/29/2019
 */
const dynamicSolver = require("./dynamic/dynamicSolver").dynamicSolver;
const THREE = require("three");
const Node = require("./node").Node;
const Beam = require("./beam").Beam;
const Crease = require("./crease").Crease;
//model updates object3d geometry and materials
module.exports.Model = class{
    constructor(config){
        this.config = config;
        this.creasePercent = 0;
        this.solver = new dynamicSolver(this.config);
        this.material, this.material2, this.geometry;
        this.frontside = new THREE.Mesh(); //front face of mesh
        this.backside = new THREE.Mesh(); //back face of mesh (different color)
        this.backside.visible = false;

        this.lineMaterial = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});
        this.hingeLines = new THREE.LineSegments(null, this.lineMaterial);
        this.mountainLines = new THREE.LineSegments(null, this.lineMaterial);
        this.valleyLines = new THREE.LineSegments(null, this.lineMaterial);
        this.cutLines = new THREE.LineSegments(null, this.lineMaterial);
        this.facetLines = new THREE.LineSegments(null, this.lineMaterial);
        this.borderLines = new THREE.LineSegments(null, this.lineMaterial);

        this.lines = {
            U: this.hingeLines,
            M: this.mountainLines,
            V: this.valleyLines,
            C: this.cutLines,
            F: this.facetLines,
            B: this.borderLines
        };

        this.positions; //place to store buffer geo vertex data
        this.colors; //place to store buffer geo vertex colors
        this.indices;
        this.nodes = [];
        this.faces = [];
        this.edges = [];
        this.creases = [];
        this.vertices = []; //indexed vertices array
        this.fold, this.creaseParams;

        this.nextCreaseParams, this.nextFold; //todo only nextFold, nextCreases?

        this.inited = false;

        this.clearGeometries();
        this.setMeshMaterial();
    }

    clearGeometries(){
        if (this.geometry) {
            this.frontside.geometry = null;
            this.backside.geometry = null;
            this.geometry.dispose();
        }

        this.geometry = new THREE.BufferGeometry();
        this.frontside.geometry = this.geometry;
        this.backside.geometry = this.geometry;
        // this.geometry.verticesNeedUpdate = true;
        this.geometry.dynamic = true;
        for(var k in this.lines){
            var line = this.lines[k];
            var lineGeometry = line.geometry;
            if (lineGeometry) {
                line.geometry = null;
                lineGeometry.dispose();
            }

            lineGeometry = new THREE.BufferGeometry();
            line.geometry = lineGeometry;
            // lineGeometry.verticesNeedUpdate = true;
            lineGeometry.dynamic = true;
        }
    }

    setCreasePercent(percent){
        percent *= 100;
        this.creasePercent = percent;
    }

    setMeshMaterial() {
        var polygonOffset = 0.5;
        if (this.config.view.colorMode == "normal") {
            this.material = new THREE.MeshNormalMaterial({
                flatShading: true,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: polygonOffset, // positive value pushes polygon further away
                polygonOffsetUnits: 1
            });
            this.backside.visible = false;
        } else if (this.config.view.colorMode == "axialStrain"){
            this.material = new THREE.MeshBasicMaterial({
                vertexColors: THREE.VertexColors,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: polygonOffset, // positive value pushes polygon further away
                polygonOffsetUnits: 1
            });
            this.backside.visible = false;
        } else {
            this.material = new THREE.MeshPhongMaterial({
                flatShading: true,
                side: THREE.FrontSide,
                polygonOffset: true,
                polygonOffsetFactor: polygonOffset, // positive value pushes polygon further away
                polygonOffsetUnits: 1
            });
            this.material2 = new THREE.MeshPhongMaterial({
                flatShading: true,
                side: THREE.BackSide,
                polygonOffset: true,
                polygonOffsetFactor: polygonOffset, // positive value pushes polygon further away
                polygonOffsetUnits: 1
            });
            this.material.color.setStyle( "#" + this.config.view.color1);
            this.material2.color.setStyle( "#" + this.config.view.color2);
            this.backside.visible = true;
        }
        this.frontside.material = this.material;
        this.backside.material = this.material2;
    }

    updateEdgeVisibility(){
        this.mountainLines.visible = this.config.view.edgesVisible && this.config.view.mtnsVisible;
        this.valleyLines.visible = this.config.view.edgesVisible && this.config.view.valleysVisible;
        this.facetLines.visible = this.config.view.edgesVisible && this.config.view.panelsVisible;
        this.hingeLines.visible = this.config.view.edgesVisible && this.config.view.passiveEdgesVisible;
        this.borderLines.visible = this.config.view.edgesVisible && this.config.view.boundaryEdgesVisible;
        this.cutLines.visible = false;
    }

    updateMeshVisibility(){
        this.frontside.visible = this.config.view.meshVisible;
        this.backside.visible = this.config.view.colorMode == "color" && this.config.view.meshVisible;
    }

    getGeometry(){
        return this.geometry;
    }

    getMesh(){
        return [this.frontside, this.backside];
    }

    getPositionsArray(){
        return this.positions;
    }

    getColorsArray(){
        return this.colors;
    }

    reset(){
        this.getSolver().reset();
    }

    step(numSteps){
        this.getSolver().solve(numSteps);
    }

    getSolver(){
        return this.solver;
    }

    buildModel(fold, creaseParams){

        if (fold.vertices_coords.length == 0) {
            config.warn("No geometry found.");
            return;
        }
        if (fold.faces_vertices.length == 0) {
            config.warn("No faces found, try adjusting import vertex merge tolerance.");
            return;
        }
        if (fold.edges_vertices.length == 0) {
            config.warn("No edges found.");
            return;
        }

        this.nextFold = fold;
        this.nextCreaseParams = creaseParams;
        this.sync();
    }

    sync(){
        for (var i=0; i<this.nodes.length; i++){
            this.nodes[i].destroy();
        }

        for (var i=0; i<this.edges.length; i++){
            this.edges[i].destroy();
        }

        for (var i=0; i<this.creases.length; i++){
            this.creases[i].destroy();
        }

        this.fold = this.nextFold;
        this.nodes = [];
        this.edges = [];
        this.faces = this.fold.faces_vertices;
        this.creases = [];
        this.creaseParams = this.nextCreaseParams;
        var _edges = this.fold.edges_vertices;

        var _vertices = [];
        for (var i=0; i<this.fold.vertices_coords.length; i++){
            var vertex = this.fold.vertices_coords[i];
            _vertices.push(new THREE.Vector3(vertex[0], vertex[1], vertex[2]));
        }

        for (var i=0; i<_vertices.length; i++){
            this.nodes.push(new Node(_vertices[i].clone(), this.nodes.length));
        }
        // _nodes[_faces[0][0]].setFixed(true);
        // _nodes[_faces[0][1]].setFixed(true);
        // _nodes[_faces[0][2]].setFixed(true);

        for (var i=0; i<_edges.length; i++) {
            this.edges.push(new Beam([this.nodes[_edges[i][0]], this.nodes[_edges[i][1]]], this.config.compliant_sim.axialStiffness, this.config.dynamic_sim.percentDamping));
        }

        for (var i=0; i<this.creaseParams.length; i++) {//allCreaseParams.length
            var _creaseParams = this.creaseParams[i];//face1Ind, vert1Ind, face2Ind, ver2Ind, edgeInd, angle
            var type = _creaseParams[5]!=0 ? 1:0;
            //edge, face1Index, face2Index, targetTheta, type, node1, node2, index
            this.creases.push(new Crease(this.edges[_creaseParams[4]], _creaseParams[0], _creaseParams[2], _creaseParams[5], type, this.nodes[_creaseParams[1]], this.nodes[_creaseParams[3]], this.creases.length));
        }

        this.vertices = [];
        for (var i=0; i<this.nodes.length; i++){
            this.vertices.push(this.nodes[i].getOriginalPosition());
        }

        this.positions = new Float32Array(this.vertices.length*3);
        this.colors = new Float32Array(this.vertices.length*3);
        this.indices = new Uint16Array(this.faces.length*3);

        for (var i=0; i<this.vertices.length; i++){
            this.positions[3*i] = this.vertices[i].x;
            this.positions[3*i+1] = this.vertices[i].y;
            this.positions[3*i+2] = this.vertices[i].z;
        }
        for (var i=0; i<this.faces.length; i++){
            var face = this.faces[i];
            this.indices[3*i] = face[0];
            this.indices[3*i+1] = face[1];
            this.indices[3*i+2] = face[2];
        }

        this.clearGeometries();

        var positionsAttribute = new THREE.BufferAttribute(this.positions, 3);

        var lineIndices = {
            U: [],
            V: [],
            M: [],
            B: [],
            F: [],
            C: []
        };
        
        for (var i=0; i<this.fold.edges_assignment.length; i++){
            let edge = this.fold.edges_vertices[i];
            let assignment = this.fold.edges_assignment[i];
            lineIndices[assignment].push(edge[0]);
            lineIndices[assignment].push(edge[1]);
        }
        for(let key in this.lines){
            var indicesArray = lineIndices[key];
            var indices = new Uint16Array(indicesArray.length);
            for (var i=0; i<indicesArray.length; i++){
                indices[i] = indicesArray[i];
            }
            this.lines[key].geometry.addAttribute('position', positionsAttribute);
            this.lines[key].geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            // lines[key].geometry.attributes.position.needsUpdate = true;
            // lines[key].geometry.index.needsUpdate = true;
            this.lines[key].geometry.computeBoundingBox();
            this.lines[key].geometry.computeBoundingSphere();
            this.lines[key].geometry.center();
        }

        this.geometry.addAttribute('position', positionsAttribute);
        this.geometry.addAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setIndex(new THREE.BufferAttribute(this.indices, 1));
        // this.geometry.attributes.position.needsUpdate = true;
        // this.geometry.index.needsUpdate = true;
        // this.geometry.verticesNeedUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingBox();
        this.geometry.computeBoundingSphere();
        this.geometry.center();

        var scale = 1/this.geometry.boundingSphere.radius;
        this.config.scale = scale;

        //scale geometry
        for (var i=0; i<this.positions.length; i++){
            this.positions[i] *= scale;
        }
        for (var i=0; i<this.vertices.length;i++){
            this.vertices[i].multiplyScalar(scale);
        }

        //update vertices and edges
        for (var i=0; i<this.vertices.length; i++){
            this.nodes[i].setOriginalPosition(this.positions[3*i], this.positions[3*i+1], this.positions[3*i+2]);
        }
        for (var i=0; i<this.edges.length; i++){
            this.edges[i].recalcOriginalLength();
        }

        this.updateEdgeVisibility();
        this.updateMeshVisibility();

        this.syncSolver();
        this.reset();
    }

    syncSolver(){
        this.getSolver().syncNodesAndEdges(this.getNodes(), this.getEdges(), this.getFaces(), this.getCreases(), this.getPositionsArray(), this.getColorsArray());
    }

    getNodes(){
        return this.nodes;
    }

    getEdges(){
        return this.edges;
    }

    getFaces(){
        return this.faces;
    }

    getCreases(){
        return this.creases;
    }

    getDimensions(){
        this.geometry.computeBoundingBox();
        return this.geometry.boundingBox.max.clone().sub(this.geometry.boundingBox.min);
    }
}