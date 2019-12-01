/**
 * Created by amandaghassaei on 2/25/17.
 */

const FOLD = require("fold");
const THREE = require("three");
const ec = require("earcut");
const numeric = require("numeric");
const Model = require("./model").Model;

module.exports.Pattern = class{
    constructor(config, fold=None){
        this.config = config;
        this.model = new Model(this.config);
        this.foldData = {};
        this.rawFold = {};
        this.verticesRaw = [];
        //refs to vertex indices
        this.mountainsRaw = [];
        this.valleysRaw = [];
        this.bordersRaw = [];
        this.cutsRaw = [];
        this.triangulationsRaw = [];
        this.hingesRaw = [];

        this.mountains = [];
        this.valleys = [];
        this.borders = [];
        this.hinges = [];
        this.triangulations = [];

        this.badColors = [];//store any bad colors in svg file to show user
        
        this.clearAll();
        this.foldData = this.collapseTriangulate(fold);
    }

    clearFold(){
        this.foldData.vertices_coords = [];
        this.foldData.edges_vertices = [];
        this.foldData.edges_assignment = [];//B = boundary, M = mountain, V = valley, C = cut, F = facet, U = hinge
        this.foldData.edges_foldAngles = [];//target angles
        delete this.foldData.vertices_vertices;
        delete this.foldData.faces_vertices;
        delete this.foldData.vertices_edges;
        this.rawFold = {};
    }

    clearAll(){
        this.clearFold();
        this.verticesRaw = [];

        this.mountainsRaw = [];
        this.valleysRaw = [];
        this.bordersRaw = [];
        this.cutsRaw = [];
        this.triangulationsRaw = [];
        this.hingesRaw = [];

        this.mountains = [];
        this.valleys = [];
        this.borders = [];
        this.hinges = [];
        this.triangulations = [];

        this.badColors = [];
    }

    collapseTriangulate(fold){
        console.log(fold);
        fold = FOLD.filter.collapseNearbyVertices(fold, parseInt(this.config.import_pattern.vertTol));
        
        console.log(fold.edges_vertices);
        //TODO: track bug down further into removeLoopEdges
        FOLD.filter.removeLoopEdges(fold); //remove edges that points to same vertex
        console.log(fold.edges_vertices);
        FOLD.filter.removeDuplicateEdges_vertices(fold); //remove duplicate edges
        //fold = FOLD.filter.subdivideCrossingEdges_vertices(fold, parseInt(this.config.import_pattern.vertTol));//find intersections and add vertices/edges
    
        fold = this.findIntersections(fold, parseInt(this.config.import_pattern.vertTol));
        //cleanup after intersection operation
        fold = FOLD.filter.collapseNearbyVertices(fold, parseInt(this.config.import_pattern.vertTol));
        FOLD.filter.removeLoopEdges(fold); //remove edges that points to same vertex
        FOLD.filter.removeDuplicateEdges_vertices(fold); //remove duplicate edges
    
        fold = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(fold);
        fold = this.removeStrayVertices(fold); //delete stray anchors
        fold = this.removeRedundantVertices(fold, 0.01); //remove vertices that split edge
    
        fold = FOLD.convert.sort_vertices_vertices(fold);
        fold = FOLD.convert.vertices_vertices_to_faces_vertices(fold);
    
        fold = this.edgesVerticesToVerticesEdges(fold);
        fold = this.removeBorderFaces(fold); //expose holes surrounded by all border edges
    
        fold = this.reverseFaceOrder(fold); //set faces to counter clockwise
    
        return this.processFold(fold);
    }

    applyTransformation(vertex, transformations){
        if (transformations == undefined) return;
        transformations = transformations.baseVal;
        for (var i=0; i<transformations.length; i++){
            var t = transformations[i];
            var M = [[t.matrix.a, t.matrix.c, t.matrix.e], [t.matrix.b, t.matrix.d, t.matrix.f], [0,0,1]];
            var out = numeric.dot(M, [vertex.x, vertex.z, 1]);
            vertex.x = out[0];
            vertex.z = out[1];
        }
    }

    parsePath(_verticesRaw, _segmentsRaw, elements){
        for (var i=0; i<elements.length; i++){
            var path = elements[i];
            var pathVertices = [];
            if (path === undefined || path.getPathData === undefined){//mobile problem
                var elm = '<div id="coverImg" ' +
                    'style="background: url(assets/doc/crane.gif) no-repeat center center fixed;' +
                    '-webkit-background-size: cover;' +
                    '-moz-background-size: cover;' +
                    '-o-background-size: cover;' +
                    'background-size: cover;">'+
                    '</div>';
                $(elm).appendTo($("body"));
                $("#noSupportModal").modal("show");
                console.warn("path parser not supported");
                return;
            }
            var segments = path.getPathData();
            for (var j=0; j<segments.length; j++){
                var segment = segments[j];
                var type = segment.type;
                switch(type){

                    case "m"://dx, dy
                        var vertex;
                        if (j === 0){//problem with inkscape files
                            vertex = new THREE.Vector3(segment.values[0], 0, segment.values[1]);
                        } else {
                            vertex = _verticesRaw[_verticesRaw.length-1].clone();
                            vertex.x += segment.values[0];
                            vertex.z += segment.values[1];
                        }
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;

                    case "l"://dx, dy
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.x += segment.values[0];
                        vertex.z += segment.values[1];
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;

                    case "v"://dy
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.z += segment.values[0];
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;

                    case "h"://dx
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.x += segment.values[0];
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;

                    case "M"://x, y
                        var vertex = new THREE.Vector3(segment.values[0], 0, segment.values[1]);
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;

                    case "L"://x, y
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        _verticesRaw.push(new THREE.Vector3(segment.values[0], 0, segment.values[1]));
                        pathVertices.push(vertex);
                        break;

                    case "V"://y
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.z = segment.values[0];
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;

                    case "H"://x
                        _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                        if (path.targetAngle && _segmentsRaw.length>0) _segmentsRaw[_segmentsRaw.length-1].push(path.targetAngle);
                        var vertex = _verticesRaw[_verticesRaw.length-1].clone();
                        vertex.x = segment.values[0];
                        _verticesRaw.push(vertex);
                        pathVertices.push(vertex);
                        break;
                }
            }
            for (var j=0; j<pathVertices.length; j++){
                this.applyTransformation(pathVertices[j], path.transform);
            }
        }
    }

    parseLine(_verticesRaw, _segmentsRaw, elements){
        for (var i=0; i<elements.length; i++){
            var element = elements[i];
            _verticesRaw.push(new THREE.Vector3(element.x1.baseVal.value, 0, element.y1.baseVal.value));
            _verticesRaw.push(new THREE.Vector3(element.x2.baseVal.value, 0, element.y2.baseVal.value));
            _segmentsRaw.push([_verticesRaw.length-2, _verticesRaw.length-1]);
            if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-1].push(element.targetAngle);
            this.applyTransformation(_verticesRaw[_verticesRaw.length-2], element.transform);
            this.applyTransformation(_verticesRaw[_verticesRaw.length-1], element.transform);
        }
    }

    parseRect(_verticesRaw, _segmentsRaw, elements){
        for (var i=0; i<elements.length; i++){
            var element = elements[i];
            var x = element.x.baseVal.value;
            var y = element.y.baseVal.value;
            var width = element.width.baseVal.value;
            var height = element.height.baseVal.value;
            _verticesRaw.push(new THREE.Vector3(x, 0, y));
            _verticesRaw.push(new THREE.Vector3(x+width, 0, y));
            _verticesRaw.push(new THREE.Vector3(x+width, 0, y+height));
            _verticesRaw.push(new THREE.Vector3(x, 0, y+height));
            _segmentsRaw.push([_verticesRaw.length-4, _verticesRaw.length-3]);
            _segmentsRaw.push([_verticesRaw.length-3, _verticesRaw.length-2]);
            _segmentsRaw.push([_verticesRaw.length-2, _verticesRaw.length-1]);
            _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length-4]);
            for (var j=1;j<=4;j++){
                if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-j].push(element.targetAngle);
                this.applyTransformation(_verticesRaw[_verticesRaw.length-j], element.transform);
            }
        }
    }

    parsePolygon(_verticesRaw, _segmentsRaw, elements){
        for (var i=0; i<elements.length; i++){
            var element = elements[i];
            for (var j=0; j<element.points.length; j++){
                _verticesRaw.push(new THREE.Vector3(element.points[j].x, 0, element.points[j].y));
                this.applyTransformation(_verticesRaw[_verticesRaw.length-1], element.transform);

                if (j<element.points.length-1) _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length]);
                else _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length-element.points.length]);

                if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-1].push(element.targetAngle);
            }
        }
    }

    parsePolyline(_verticesRaw, _segmentsRaw, elements){
        for (var i=0; i<elements.length; i++){
            var element = elements[i];
            for (var j=0;j<element.points.length;j++){
                _verticesRaw.push(new THREE.Vector3(element.points[j].x, 0, element.points[j].y));
                this.applyTransformation(_verticesRaw[_verticesRaw.length-1], element.transform);
                if (j>0) _segmentsRaw.push([_verticesRaw.length-1, _verticesRaw.length-2]);
                if (element.targetAngle) _segmentsRaw[_segmentsRaw.length-1].push(element.targetAngle);
            }
        }
    }

    processFold(fold, returnCreaseParams){
        var rawFold = this.rawfold;
        rawFold = JSON.parse(JSON.stringify(fold));//save pre-triangulated for for save later
        //make 3d
        for (var i=0;i<rawFold.vertices_coords.length;i++){
            var vertex = rawFold.vertices_coords[i];
            if (vertex.length === 2) {//make vertices_coords 3d
                rawFold.vertices_coords[i] = [vertex[0], 0, vertex[1]];
            }
        }

        // var cuts = FOLD.filter.cutEdges(fold);
        // if (cuts.length>0) {
        //     fold = this.splitCuts(fold);
        //     fold = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(fold);
        //     fold = this.removeRedundantVertices(fold, 0.01);//remove vertices that split edge
        // }
        delete fold.vertices_vertices;
        delete fold.vertices_edges;
        var foldData = this.foldData;
        foldData = this.triangulatePolys(fold, true);

        for (var i=0; i<foldData.vertices_coords.length; i++){
            var vertex = foldData.vertices_coords[i];
            if (vertex.length === 2) {//make vertices_coords 3d
                foldData.vertices_coords[i] = [vertex[0], 0, vertex[1]];
            }
        }

        this.mountains = FOLD.filter.mountainEdges(foldData);
        this.valleys = FOLD.filter.valleyEdges(foldData);
        this.borders = FOLD.filter.boundaryEdges(foldData);
        this.hinges = FOLD.filter.unassignedEdges(foldData);
        this.triangulations = FOLD.filter.flatEdges(foldData);

        // $("#numMtns").html("(" + this.mountains.length + ")");
        // $("#numValleys").html("(" + this.valleys.length + ")");
        // $("#numFacets").html("(" + this.triangulations.length + ")");
        // $("#numBoundary").html("(" + this.borders.length + ")");
        // $("#numPassive").html("(" + this.hinges.length + ")");
        // TODO precompute vertices_face
        var allCreaseParams = this.getFacesAndVerticesForEdges(foldData);
        if (returnCreaseParams) return allCreaseParams;

        this.model.buildModel(foldData, allCreaseParams);
        return foldData;
    }

    reverseFaceOrder(fold){
        for (var i=0; i<fold.faces_vertices.length; i++){
            fold.faces_vertices[i].reverse();
        }
        return fold;
    }

    edgesVerticesToVerticesEdges(fold){
        var verticesEdges = [];
        for (var i=0; i<fold.vertices_coords.length; i++){
            verticesEdges.push([]);
        }
        for (var i=0; i<fold.edges_vertices.length; i++){
            var edge = fold.edges_vertices[i];
            verticesEdges[edge[0]].push(i);
            verticesEdges[edge[1]].push(i);
        }
        fold.vertices_edges = verticesEdges;
        return fold;
    }

    facesVerticesToVerticesFaces(fold){
        var verticesFaces = [];
        for (var i=0; i<fold.vertices_coords.length; i++){
            verticesFaces.push([]);
        }
        for (var i=0; i<fold.faces_vertices.length; i++){
            var face = fold.faces_vertices[i];
            for (var j=0; j<face.length; j++){
                verticesFaces[face[j]].push(i);
            }
        }
        fold.vertices_faces = verticesFaces;
        return fold;
    }

    sortVerticesEdges(fold){
        for (var i=0; i<fold.vertices_vertices.length; i++){
            var verticesVertices = fold.vertices_vertices[i];
            var verticesEdges = fold.vertices_edges[i];
            var sortedVerticesEdges = [];
            for (var j=0; j<verticesVertices.length; j++){
                var index = -1;
                for (var k=0;k<verticesEdges.length;k++){
                    var edgeIndex = verticesEdges[k];
                    var edge = fold.edges_vertices[edgeIndex];
                    if (edge.indexOf(verticesVertices[j])>=0){
                        index = edgeIndex;
                        break;
                    }
                }
                if (index<0) console.warn("no matching edge found, fix this");
                sortedVerticesEdges.push(index);
            }
            fold.vertices_edges[i] = sortedVerticesEdges;
        }
        return fold;
    }

    splitCuts(fold){
        fold = this.sortVerticesEdges(fold);
        fold = this.facesVerticesToVerticesFaces(fold);
        //go around each vertex and split cut in clockwise order
        for (var i=0; i<fold.vertices_edges.length; i++){
            var groups = [[]];
            var groupIndex = 0;
            var verticesEdges = fold.vertices_edges[i];
            var verticesFaces = fold.vertices_faces[i];
            for (var j=0; j<verticesEdges.length; j++){
                var edgeIndex = verticesEdges[j];
                var assignment = fold.edges_assignment[edgeIndex];
                groups[groupIndex].push(edgeIndex);
                if (assignment == "C"){
                    //split cut edge into two boundary edges
                    groups.push([fold.edges_vertices.length]);
                    groupIndex++;
                    var newEdgeIndex = fold.edges_vertices.length;
                    var edge = fold.edges_vertices[edgeIndex];
                    fold.edges_vertices.push([edge[0], edge[1]]);
                    fold.edges_assignment[edgeIndex] = "B";
                    fold.edges_foldAngles.push(null);
                    fold.edges_assignment.push("B");
                    //add new boundary edge to other vertex
                    var otherVertex = edge[0];
                    if (otherVertex == i) otherVertex = edge[1];
                    var otherVertexEdges = fold.vertices_edges[otherVertex];
                    var otherVertexEdgeIndex = otherVertexEdges.indexOf(edgeIndex);
                    otherVertexEdges.splice(otherVertexEdgeIndex, 0, newEdgeIndex);
                } else if (assignment == "B"){
                    if (j==0 && verticesEdges.length>1){
                        //check if next edge is also boundary
                        var nextEdgeIndex = verticesEdges[1];
                        if (fold.edges_assignment[nextEdgeIndex] == "B"){
                            //check if this edge shares a face with the next
                            var edge = fold.edges_vertices[edgeIndex];
                            var otherVertex = edge[0];
                            if (otherVertex == i) otherVertex = edge[1];
                            var nextEdge = fold.edges_vertices[nextEdgeIndex];
                            var nextVertex  = nextEdge[0];
                            if (nextVertex == i) nextVertex = nextEdge[1];
                            if (this.connectedByFace(fold, fold.vertices_faces[i], otherVertex, nextVertex)){
                            } else {
                                groups.push([]);
                                groupIndex++;
                            }
                        }
                    } else if (groups[groupIndex].length>1) {
                        groups.push([]);
                        groupIndex++;
                    }
                }
            }
            if (groups.length <= 1) continue;
            for (var k=groups[groupIndex].length-1; k>=0; k--){//put remainder of last group in first group
                groups[0].unshift(groups[groupIndex][k]);
            }
            groups.pop();
            for (var j=1; j<groups.length; j++){//for each extra group, assign new vertex
                var currentVertex = fold.vertices_coords[i];
                var vertIndex = fold.vertices_coords.length;
                fold.vertices_coords.push(currentVertex.slice());//make a copy
                var connectingIndices = [];
                for (var k=0; k<groups[j].length; k++){//update edges_vertices
                    var edgeIndex = groups[j][k];
                    var edge = fold.edges_vertices[edgeIndex];
                    var otherIndex = edge[0];
                    if (edge[0] == i) {
                        edge[0] = vertIndex;
                        otherIndex = edge[1];
                    } else edge[1] = vertIndex;
                    connectingIndices.push(otherIndex);
                }
                if (connectingIndices.length<2) {
                    console.warn("problem here");
                } else {
                    for (var k=1; k<connectingIndices.length; k++){//update faces_vertices
                        //i, k-1, k
                        var thisConnectingVertIndex = connectingIndices[k];
                        var previousConnectingVertIndex = connectingIndices[k-1];
                        var found = false;
                        for (var a=0; a<verticesFaces.length; a++){
                            var face = fold.faces_vertices[verticesFaces[a]];
                            var index1 = face.indexOf(thisConnectingVertIndex);
                            var index2 = face.indexOf(previousConnectingVertIndex);
                            var index3 = face.indexOf(i);
                            if (index1 >= 0 && index2 >= 0 && index3>=0 &&
                                (Math.abs(index1-index3) === 1 || Math.abs(index1-index3) === face.length-1) &&
                                (Math.abs(index2-index3) === 1 || Math.abs(index2-index3) === face.length-1)){
                                found = true;
                                face[index3] = vertIndex;
                                break;
                            }
                        }
                        if (!found) console.warn("problem here");
                    }
                }
            }
        }
        //these are all incorrect now
        delete fold.vertices_faces;
        delete fold.vertices_edges;
        delete fold.vertices_vertices;
        return fold;
    }

    connectedByFace(fold, verticesFaces, vert1, vert2){
        if (vert1 == vert2) return false;
        for (var a=0; a<verticesFaces.length; a++){
            var face = fold.faces_vertices[verticesFaces[a]];
            if (face.indexOf(vert1) >= 0 && face.indexOf(vert2) >= 0){
                return true;
            }
        }
        return false;
    }

    removeBorderFaces(fold){
        for (var i=fold.faces_vertices.length-1; i>=0; i--){
            var face = fold.faces_vertices[i];
            var allBorder = true;

            for (var j=0; j<face.length; j++){
                var vertexIndex = face[j];
                var nextIndex = j+1;
                if (nextIndex >= face.length) nextIndex = 0;
                var nextVertexIndex = face[nextIndex];
                var connectingEdgeFound = false;
                for (var k=0; k<fold.vertices_edges[vertexIndex].length; k++){
                    var edgeIndex = fold.vertices_edges[vertexIndex][k];
                    var edge = fold.edges_vertices[edgeIndex];
                    if ((edge[0] == vertexIndex && edge[1] == nextVertexIndex) ||
                        (edge[1] == vertexIndex && edge[0] == nextVertexIndex)){
                        connectingEdgeFound = true;
                        var assignment = fold.edges_assignment[edgeIndex];
                        if (assignment != "B"){
                            allBorder = false;
                            break;
                        }
                    }
                }
                if (!connectingEdgeFound) console.warn("no connecting edge found on face");
                if (!allBorder) break;
            }
            if (allBorder) fold.faces_vertices.splice(i,1);
        }
        return fold;
    }

    getFacesAndVerticesForEdges(fold){
        var allCreaseParams = [];//face1Ind, vertInd, face2Ind, ver2Ind, edgeInd, angle
        var faces = fold.faces_vertices;
        for (var i=0; i<fold.edges_vertices.length; i++){
            var assignment = fold.edges_assignment[i];
            if (assignment !== "M" && assignment !== "V" && assignment !== "F") continue;
            var edge = fold.edges_vertices[i];
            var v1 = edge[0];
            var v2 = edge[1];
            var creaseParams = [];
            for (var j=0; j<faces.length; j++){
                var face = faces[j];
                var faceVerts = [face[0], face[1], face[2]];
                var v1Index = faceVerts.indexOf(v1);
                if (v1Index>=0){
                    var v2Index = faceVerts.indexOf(v2);
                    if (v2Index>=0){
                        creaseParams.push(j);
                        if (v2Index>v1Index) {
                            faceVerts.splice(v2Index, 1);
                            faceVerts.splice(v1Index, 1);
                        } else {
                            faceVerts.splice(v1Index, 1);
                            faceVerts.splice(v2Index, 1);
                        }
                        creaseParams.push(faceVerts[0]);
                        if (creaseParams.length == 4) {

                            if (v2Index-v1Index == 1 || v2Index-v1Index == -2) {
                                creaseParams = [creaseParams[2], creaseParams[3], creaseParams[0], creaseParams[1]];
                            }

                            creaseParams.push(i);
                            // var angle = fold.edges_foldAngles[i];
                            // creaseParams.push(angle);
                            allCreaseParams.push(creaseParams);
                            break;
                        }
                    }
                }
            }
        }
        return allCreaseParams;
    }

    removeRedundantVertices(fold, epsilon){
        var old2new = [];
        var numRedundant = 0;
        var newIndex = 0;
        for (var i=0; i<fold.vertices_vertices.length; i++){
            var vertex_vertices = fold.vertices_vertices[i];
            if (vertex_vertices.length != 2) {
                old2new.push(newIndex++);
                continue;
            }
            var vertex_coord = fold.vertices_coords[i];
            var neighbor0 = fold.vertices_coords[vertex_vertices[0]];
            var neighbor1 = fold.vertices_coords[vertex_vertices[1]];
            var threeD = vertex_coord.length == 3;
            var vec0 = [neighbor0[0]-vertex_coord[0], neighbor0[1]-vertex_coord[1]];
            var vec1 = [neighbor1[0]-vertex_coord[0], neighbor1[1]-vertex_coord[1]];
            var magSqVec0 = vec0[0]*vec0[0]+vec0[1]*vec0[1];
            var magSqVec1 = vec1[0]*vec1[0]+vec1[1]*vec1[1];
            var dot = vec0[0]*vec1[0]+vec0[1]*vec1[1];
            if (threeD){
                vec0.push(neighbor0[2]-vertex_coord[2]);
                vec1.push(neighbor1[2]-vertex_coord[2]);
                magSqVec0 += vec0[2]*vec0[2];
                magSqVec1 += vec1[2]*vec1[2];
                dot += vec0[2]*vec1[2];
            }
            dot /= Math.sqrt(magSqVec0*magSqVec1);
            if (Math.abs(dot + 1.0)<epsilon){
                var merged = this.mergeEdge(fold, vertex_vertices[0], i, vertex_vertices[1]);
                if (merged){
                    numRedundant++;
                    old2new.push(null);
                } else {
                    old2new.push(newIndex++);
                    continue;
                }
            } else old2new.push(newIndex++);
        }
        if (numRedundant == 0) return fold;
        console.warn(numRedundant + " redundant vertices found");
        fold = FOLD.filter.remapField(fold, 'vertices', old2new);
        if (fold.faces_vertices){
            for (var i=0; i<fold.faces_vertices.length; i++){
                var face = fold.faces_vertices[i];
                for (var j=face.length-1; j>=0; j--){
                    if (face[j] === null) face.splice(j, 1);
                }
            }
        }
        return fold;
    }

    mergeEdge(fold, v1, v2, v3){//v2 is center vertex
        var angleAvg = 0;
        var avgSum = 0;
        var angles = [];
        var edgeAssignment = null;
        var edgeIndices = [];
        for (var i=fold.edges_vertices.length-1; i>=0; i--){
            var edge = fold.edges_vertices[i];
            if (edge.indexOf(v2)>=0 && (edge.indexOf(v1) >= 0 || edge.indexOf(v3) >= 0)){
                if (edgeAssignment === null) edgeAssignment = fold.edges_assignment[i];
                else if (edgeAssignment != fold.edges_assignment[i]) {
                    console.log(edgeAssignment, fold.edges_assignment[i]);
                    console.warn("different edge assignments");
                    return false;
                }
                var angle = fold.edges_foldAngles[i];
                if (isNaN(angle)) console.log(i);
                angles.push(angle);
                if (angle) {
                    angleAvg += angle;
                    avgSum++;
                }
                edgeIndices.push(i);//larger index in front
            }
        }
        if (angles[0] != angles[1]){
            console.warn("incompatible angles: " + JSON.stringify(angles));
        }
        for (var i=0; i<edgeIndices.length; i++){
            var index = edgeIndices[i];
            fold.edges_vertices.splice(index, 1);
            fold.edges_assignment.splice(index, 1);
            fold.edges_foldAngles.splice(index, 1);
        }
        fold.edges_vertices.push([v1, v3]);
        fold.edges_assignment.push(edgeAssignment);
        if (avgSum > 0) fold.edges_foldAngles.push(angleAvg/avgSum);
        else fold.edges_foldAngles.push(null);
        var index = fold.vertices_vertices[v1].indexOf(v2);
        fold.vertices_vertices[v1].splice(index, 1);
        fold.vertices_vertices[v1].push(v3);
        index = fold.vertices_vertices[v3].indexOf(v2);
        fold.vertices_vertices[v3].splice(index, 1);
        fold.vertices_vertices[v3].push(v1);
        return true;
    }

    removeStrayVertices(fold){
        if (!fold.vertices_vertices) {
            console.warn("compute vertices_vertices first");
            fold = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(fold);
        }
        var numStrays = 0;
        var old2new = [];
        var newIndex = 0;
        for (var i=0; i<fold.vertices_vertices.length; i++){
            if (fold.vertices_vertices[i] === undefined || fold.vertices_vertices[i].length==0) {
                numStrays++;
                old2new.push(null);
            } else old2new.push(newIndex++);
        }
        if (numStrays == 0) return fold;
        console.warn(numStrays+ " stray vertices found");
        return FOLD.filter.remapField(fold, 'vertices', old2new);
    }

    triangulatePolys(fold, is2d){
        var vertices = fold.vertices_coords;
        var faces = fold.faces_vertices;
        var edges = fold.edges_vertices;
        var foldAngles = fold.edges_foldAngles;
        var assignments = fold.edges_assignment;
        var triangulatedFaces = [];
        for (var i=0; i<faces.length; i++){

            var face = faces[i];

            if (face.length == 3){
                triangulatedFaces.push(face);
                continue;
            }

            //check for quad and solve manually
            if (face.length == 4){
                var faceV1 = makeVector(vertices[face[0]]);
                var faceV2 = makeVector(vertices[face[1]]);
                var faceV3 = makeVector(vertices[face[2]]);
                var faceV4 = makeVector(vertices[face[3]]);
                var dist1 = (faceV1.clone().sub(faceV3)).lengthSq();
                var dist2 = (faceV2.clone().sub(faceV4)).lengthSq();
                if (dist2<dist1) {
                    edges.push([face[1], face[3]]);
                    foldAngles.push(0);
                    assignments.push("F");
                    triangulatedFaces.push([face[0], face[1], face[3]]);
                    triangulatedFaces.push([face[1], face[2], face[3]]);
                } else {
                    edges.push([face[0], face[2]]);
                    foldAngles.push(0);
                    assignments.push("F");
                    triangulatedFaces.push([face[0], face[1], face[2]]);
                    triangulatedFaces.push([face[0], face[2], face[3]]);
                }
                continue;
            }

            var faceEdges = [];
            for (var j=0; j<edges.length; j++){
                var edge = edges[j];
                if (face.indexOf(edge[0]) >= 0 && face.indexOf(edge[1]) >= 0){
                    faceEdges.push(j);
                }
            }

            var faceVert = [];
            for (var j=0; j<face.length; j++){
                var vertex = vertices[face[j]];
                faceVert.push(vertex[0]);
                faceVert.push(vertex[1]);
                if (!is2d) faceVert.push(vertex[2]);
            }

            var triangles = ec.earcut(faceVert, null, is2d? 2:3);

            for (var j=0; j<triangles.length; j+=3){
                var tri = [face[triangles[j+2]], face[triangles[j+1]], face[triangles[j]]];
                var foundEdges = [false, false, false];//ab, bc, ca

                for (var k=0; k<faceEdges.length; k++){
                    var edge = edges[faceEdges[k]];

                    var aIndex = edge.indexOf(tri[0]);
                    var bIndex = edge.indexOf(tri[1]);
                    var cIndex = edge.indexOf(tri[2]);

                    if (aIndex >= 0){
                        if (bIndex >= 0) {
                            foundEdges[0] = true;
                            continue;
                        }
                        if (cIndex >= 0) {
                            foundEdges[2] = true;
                            continue;
                        }
                    }
                    if (bIndex >= 0){
                        if (cIndex >= 0) {
                            foundEdges[1] = true;
                            continue;
                        }
                    }
                }

                for (var k=0; k<3; k++){
                    if (foundEdges[k]) continue;
                    if (k==0){
                        faceEdges.push(edges.length);
                        edges.push([tri[0], tri[1]]);
                        foldAngles.push(0);
                        assignments.push("F");
                    } else if (k==1){
                        faceEdges.push(edges.length);
                        edges.push([tri[2], tri[1]]);
                        foldAngles.push(0);
                        assignments.push("F");
                    } else if (k==2){
                        faceEdges.push(edges.length);
                        edges.push([tri[2], tri[0]]);
                        foldAngles.push(0);
                        assignments.push("F");
                    }
                }

                triangulatedFaces.push(tri);
            }
        }
        fold.faces_vertices = triangulatedFaces;
        return fold;
    }

    foldAngles(fold){
        model.setCreasePercent(1);
        var foldAngles = [];
        for (var i=0; i<fold.edges_assignment.length; i++){
            var assignment = fold.edges_assignment[i];
            if (assignment == "F") foldAngles.push(0);
            else foldAngles.push(null);
        }
        fold.edges_foldAngles = foldAngles;

        var allCreaseParams = this.setFoldData(fold, true);
        var j = 0;
        var faces = this.getTriangulatedFaces();
        for (var i=0; i<fold.edges_assignment.length; i++){
            var assignment = fold.edges_assignment[i];
            if (assignment !== "M" && assignment !== "V" && assignment !== "F") continue;
            var creaseParams = allCreaseParams[j];
            var face1 = faces[creaseParams[0]];
            var vec1 = makeVector(fold.vertices_coords[face1[1]]).sub(makeVector(fold.vertices_coords[face1[0]]));
            var vec2 = makeVector(fold.vertices_coords[face1[2]]).sub(makeVector(fold.vertices_coords[face1[0]]));
            var normal1 = (vec2.cross(vec1)).normalize();
            var face2 = faces[creaseParams[2]];
            vec1 = makeVector(fold.vertices_coords[face2[1]]).sub(makeVector(fold.vertices_coords[face2[0]]));
            vec2 = makeVector(fold.vertices_coords[face2[2]]).sub(makeVector(fold.vertices_coords[face2[0]]));
            var normal2 = (vec2.cross(vec1)).normalize();
            var angle = Math.abs(normal1.angleTo(normal2));
            if (assignment == "M") angle *= -1;
            fold.edges_foldAngles[i] = angle;
            creaseParams[5] = angle;
            j++;
        }
        return fold;
    }

    findIntersections(fold, tol){
        var vertices = fold.vertices_coords;
        var edges = fold.edges_vertices;
        var foldAngles = fold.edges_foldAngles;
        var assignments = fold.edges_assignment;
        for (var i=edges.length-1; i>=0; i--){
            for (var j=i-1; j>=0; j--){
                var v1 = makeVector2(vertices[edges[i][0]]);
                var v2 = makeVector2(vertices[edges[i][1]]);
                var v3 = makeVector2(vertices[edges[j][0]]);
                var v4 = makeVector2(vertices[edges[j][1]]);
                var data = line_intersect(v1, v2, v3, v4);
                if (data) {
                    var length1 = (v2.clone().sub(v1)).length();
                    var length2 = (v4.clone().sub(v3)).length();
                    var d1 = getDistFromEnd(data.t1, length1, tol);
                    var d2 = getDistFromEnd(data.t2, length2, tol);
                    if (d1 === null || d2 === null) continue;//no crossing

                    var seg1Int = d1>tol && d1<length1-tol;
                    var seg2Int = d2>tol && d2<length2-tol;
                    if (!seg1Int && !seg2Int) continue;//intersects at endpoints only

                    var vertIndex;
                    if (seg1Int && seg2Int){
                        vertIndex = vertices.length;
                        vertices.push([data.intersection.x,  data.intersection.y]);
                    } else if (seg1Int){
                        if (d2<=tol) vertIndex = edges[j][0];
                        else vertIndex = edges[j][1];
                    } else {
                        if (d1<=tol) vertIndex = edges[i][0];
                        else vertIndex = edges[i][1];
                    }

                    if (seg1Int){
                        var foldAngle = foldAngles[i];
                        var assignment = assignments[i];
                        edges.splice(i, 1, [vertIndex, edges[i][0]], [vertIndex, edges[i][1]]);
                        foldAngles.splice(i, 1, foldAngle, foldAngle);
                        assignments.splice(i, 1, assignment, assignment);
                        i++;
                    }
                    if (seg2Int){
                        var foldAngle = foldAngles[j];
                        var assignment = assignments[j];
                        edges.splice(j, 1, [vertIndex, edges[j][0]], [vertIndex, edges[j][1]]);
                        foldAngles.splice(j, 1, foldAngle, foldAngle);
                        assignments.splice(j, 1, assignment, assignment);
                        j++;
                        i++;
                    }
                }
            }
        }
        return fold;
    }

    getFoldData(raw){
        if (raw) return this.rawFold;
        return this.foldData;
    }

    setFoldData(fold, returnCreaseParams){
        this.clearAll();
        return this.processFold(fold, returnCreaseParams);
    }

    getTriangulatedFaces(){
        return this.foldData.faces_vertices;
    }
};

function makeVector(v){
    if (v.length == 2) return makeVector2(v);
    return makeVector3(v);
}
function makeVector2(v){
    return new THREE.Vector2(v[0], v[2]);
}
function makeVector3(v){
    return new THREE.Vector3(v[0], v[1], v[2]);
}

function getDistFromEnd(t, length, tol){
    var dist = t*length;
    if (dist < -tol) return null;
    if (dist > length+tol) return null;
    return dist;
}

//http://paulbourke.net/geometry/pointlineplane/
function line_intersect(v1, v2, v3, v4) {
    var x1 = v1.x;
    var y1 = v1.y;
    var x2 = v2.x;
    var y2 = v2.y;
    var x3 = v3.x;
    var y3 = v3.y;
    var x4 = v4.x;
    var y4 = v4.y;

    var ua, ub, denom = (y4 - y3)*(x2 - x1) - (x4 - x3)*(y2 - y1);
    if (denom == 0) {
        return null;
    }
    ua = ((x4 - x3)*(y1 - y3) - (y4 - y3)*(x1 - x3))/denom;
    ub = ((x2 - x1)*(y1 - y3) - (y2 - y1)*(x1 - x3))/denom;
    return {
        intersection: new THREE.Vector2(x1 + ua*(x2 - x1), y1 + ua*(y2 - y1)),
        t1: ua,
        t2: ub
    };
}
