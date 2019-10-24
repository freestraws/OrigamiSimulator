const pattern = require("./pattern");
const globals = require("./globals");

module.exports.load = function(data){
    var fold = JSON.parse(data);
    if (!fold || !fold.vertices_coords || !fold.edges_assignment || !fold.edges_vertices || !fold.faces_vertices){
        globals.warn("Invalid FOLD file, must contain all of: <br/>" +
            "<br/>vertices_coords<br/>edges_vertices<br/>edges_assignment<br/>faces_vertices");
        return;
    }

    if (fold.edges_foldAngles){
        pattern.setFoldData(fold);
        return;
    }
    if (globals.foldUseAngles) {
        fold = pattern.foldAngles(fold);
        globals.model.buildModel(fold, allCreaseParams);
        return;
    }
    var foldAngles = [];
    for (var i=0;i<fold.edges_assignment.length;i++){
        var assignment = fold.edges_assignment[i];
        if (assignment == "M") foldAngles.push(-Math.PI);
        else if (assignment == "V") foldAngles.push(Math.PI);
        else if (assignment == "F") foldAngles.push(0);
        else foldAngles.push(null);
    }
    fold.edges_foldAngles = foldAngles;
    pattern.setFoldData(fold);
};