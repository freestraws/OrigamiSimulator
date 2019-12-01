/**
 * Created by amandaghassaei on 5/2/17.
 */
const THREE = require('three');

module.exports.makeSaveGEO = function(model, doublesided){
    var geo = new THREE.Geometry().fromBufferGeometry( model.getGeometry() );

    if (geo.vertices.length == 0 || geo.faces.length == 0) {
        console.warn("No geometry to save.");
        return;
    }
    geo.vertices.forEach(function(_, index){
        this[index].multiplyScalar(model.config.exportScale/model.config.scale);
    }, geo.vertices);


    if (model.config.thickenModel) thickenModel();

    if (doublesided){
        geo.faces.forEach(function(face){
            geo.faces.push(new THREE.Face3(face.a, face.c, face.b));
        });
    }

    return geo;
};


function thickenModel(config){
    var numVertices = geo.vertices.length;
    geo.computeVertexNormals();
    geo.computeFaceNormals();
    geo.vertices.forEach(function(vert, i){
        var vertexNormal = geo.faces.reduce(function(vertexNormal, face, j){
            var a = vert[face.a], b = vert[face.b], c = vert[face.c];
            if(i in [face.a, face.b, face.c]){
                var x = c ? face.a == i : a;
                var y = c ? face.b == i : b;
                var z = a ? face.a == i : b ? face.b == i : c;
                var weight = Math.abs(Math.acos( (y.clone().sub(z)).normalize().dot( (x.clone().sub(z)).normalize() ) ));
                vertexNormal.add(face.normal.clone().multiplyScalar(weight));
                return vertexNormal;
            }
        }, new THREE.Vector3());

        //filter out duplicate normals
        vertexNormal.normalize();
        console.log(vertexNormal);
        var offset = vertexNormal.clone().multiplyScalar(config.thickenOffset);

        geo.vertices.push(geo.vertices[i].clone().sub(offset));
        geo.vertices[i].add(offset);
    });
    

    geo.faces.forEach(function(face){
        face.a += numVertices;
        face.b += numVertices;
        face.c += numVertices;
        var b = face.b;
        face.b = face.c;
        face.c = b;
        geo.faces.push(face);
    });
    geo.computeVertexNormals();
    geo.computeFaceNormals();
}


module.exports.saveSTL = function(model, doublesidedSTL){
    var data = [];
    if (doublesidedSTL == None) doublesidedSTL = model.config.doublesidedSTL;
    data.push({geo: makeSaveGEO(model, doublesidedSTL), offset: new THREE.Vector3(0,0,0), orientation: new THREE.Quaternion(0,0,0,1)});
    var stlBin = geometryToSTLBin(data);
    if (!stlBin) return;
    return stlBin;
};

module.exports.objFileContent = function(pattern){
    //custom export to be compatible with freeform origami
    var geo = new THREE.Geometry().fromBufferGeometry( pattern.model.getGeometry() );
    var flatGeo = pattern.getFoldData(false);

    if (geo.vertices.length == 0 || geo.faces.length == 0) {
        console.warn("No geometry to save.");
        return;
    }
    geo.vertices.forEach(function(_, index){
        this[index].multiplyScalar(parseFloat(pattern.config.save_stl.exportScale)/pattern.config.scale);
    }, geo.vertices);

    var fold = pattern.getFoldData(false);
    var obj = "#output from http://apps.amandaghassaei.com/OrigamiSimulator/\n";
    obj += "# "+ geo.vertices.length + " vertices\n";
    obj = geo.vertices.reduce(function(acc, vertex){
        return acc + "v " + vertex.x + " " + vertex.y + " " + vertex.z + "\n";
    }, obj);
    obj += "# uv texture coords\n";

    // first get bounds for normalization
    var minmax = flatGeo.vertices_coords.reduce(function(acc, vertex){
        acc[0] = [Math.min(vertex[0], acc[0][0]), Math.min(vertex[1], acc[0][1])];
        acc[1] = [Math.max(vertex[0], acc[1][0]), Math.max(vertex[1], acc[1][1])];
        return acc;
    }, [[Infinity, Infinity], [-Infinity, -Infinity]]);
    var min = minmax[0], max = minmax[1];

    var scale = max[0] - min[0];
    if (max[1] - min[1] > scale) scale = max[1] - min[1];
    obj = flatGeo.vertices_coords.reduce(function(acc, vertex){
        return acc + "vt " + (vertex[0] - min[0]) / scale + " " + (vertex[2] - min[1]) / scale + "\n";
    }, obj);
    obj += "# "+ fold.faces_vertices.length + " faces\n"; //triangular faces
    obj = flatGeo.faces_vertices.reduce(function(acc, face){
        return acc + "f " + (face[0]+1) + "/" + (face[0]+1) + " " + (face[1]+1) + "/" + (face[1]+1)+ " " +
         (face[2]+1) + "/" + (face[2]+1) + "\n";
    }, obj);

    obj += "# "+ fold.edges_vertices.length + " edges\n"; //triangular faces
    fold.edges_vertices.forEach(function(edge, i){
        obj += "#e " + (edge[0]+1) + " " + (edge[1]+1) + " ";
        if (fold.edges_assignment[i] == "F") obj += 1;
        else if (fold.edges_assignment[i] == "B") obj += 0;
        else if (fold.edges_assignment[i] == "M") obj += 3;
        else if (fold.edges_assignment[i] == "V") obj += 2;
        else {
            console.log("don't know how to convert type " + fold.edges_assignment[i]);
            obj += 0;
        }
        obj += " 0\n";
    });
    return obj;
};

// filename includes extension, type for ex. 'application/octet-binary'
function saveAsBlob(filename, type){
    var blob = new Blob([obj], {type: type});
    saveAs(blob, filename);
}