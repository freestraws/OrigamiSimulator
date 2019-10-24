const THREE = require("three");
const pattern = require("./pattern");
const FOLD = require('fold');

var filters = {
    //filter for svg parsing
    border: function(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "border";
    },
    mountain: function(){
        var $this = $(this);
        var stroke = getStroke($this);
        if (typeForStroke(stroke) == "mountain"){
            var opacity = getOpacity($this);
            this.targetAngle = -opacity*Math.PI;
            return true;
        }
        return false;
    },
    valley: function(){
        var $this = $(this);
        var stroke = getStroke($this);
        if (typeForStroke(stroke) == "valley"){
            var opacity = getOpacity($this);
            this.targetAngle = opacity*Math.PI;
            return true;
        }
        return false;
    },
    cut: function(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "cut";
    },
    triangulation: function(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "triangulation";
    },
    hinge: function(){
        var stroke = getStroke($(this));
        return typeForStroke(stroke) == "hinge";
    }
};

export function save(){
    if (globals.extension == "fold"){
        //todo solve for crease pattern
        console.warn("No crease pattern available for files imported from FOLD format.");
        return;
    }
    var serializer = new XMLSerializer();
    var source = serializer.serializeToString($("#svgViewer>svg").get(0));
    var svgBlob = new Blob([source], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download =  globals.filename + ".svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

export function load(data){
    var p = new pattern.Pattern();
    p.clearAll();

    var paths = data.find("path");
    var lines = data.find("line");
    var rects = data.find("rect");
    var polygons = data.find("polygon");
    var polylines = data.find("polyline");
    // paths.css({fill:"none", 'stroke-dasharray':"none"});
    // lines.css({fill:"none", 'stroke-dasharray':"none"});
    // rects.css({fill:"none", 'stroke-dasharray':"none"});
    // polygons.css({fill:"none", 'stroke-dasharray':"none"});
    // polylines.css({fill:"none", 'stroke-dasharray':"none"});

    findType(pattern, pattern.bordersRaw, filters.border, paths, lines, rects, polygons, polylines);
    findType(pattern, pattern.mountainsRaw, filters.mountain, paths, lines, rects, polygons, polylines);
    findType(pattern, pattern.valleysRaw, filters.valley, paths, lines, rects, polygons, polylines);
    findType(pattern, pattern.cutsRaw, filters.cut, paths, lines, rects, polygons, polylines);
    findType(pattern, pattern.triangulationsRaw, filters.triangulation, paths, lines, rects, polygons, polylines);
    findType(pattern, pattern.hingesRaw, filters.hinge, paths, lines, rects, polygons, polylines);

    badColors = pattern.badColors;

    if (badColors.length>0){
        badColors = _.uniq(badColors);
        var string = "Some objects found with the following stroke colors:<br/><br/>";
        _.each(badColors, function(color){
            string += "<span style='background:" + color + "' class='colorSwatch'></span>" + color + "<br/>";
        });
        string +=  "<br/>These objects were ignored.<br/>  Please check that your file is set up correctly, <br/>" +
            "see <b>File > File Import Tips</b> for more information.";
        console.log(string);
    }

    //todo revert back to old pattern if bad import
    var success = parseSVG(pattern, pattern.verticesRaw, pattern.bordersRaw, pattern.mountainsRaw, pattern.valleysRaw, pattern.cutsRaw, pattern.triangulationsRaw, pattern.hingesRaw);
    if (!success) return;

    //find max and min vertices
    var max = new THREE.Vector3(-Infinity,-Infinity,-Infinity);
    var min = new THREE.Vector3(Infinity,Infinity,Infinity);
    rawFold = pattern.rawFold;
    for (var i=0; i<rawFold.vertices_coords.length; i++){
        var vertex = new THREE.Vector3(rawFold.vertices_coords[i][0], rawFold.vertices_coords[i][1], rawFold.vertices_coords[i][2]);
        max.max(vertex);
        min.min(vertex);
    }
    if (min.x === Infinity){
        if (badColors.length == 0) console.log("no geometry found in file");
        return;
    }
    max.sub(min);
    var border = new THREE.Vector3(0.1, 0, 0.1);
    var scale = max.x;
    if (max.z < scale) scale = max.z;
    if (scale == 0) return;

    var strokeWidth = scale/300;
    border.multiplyScalar(scale);
    min.sub(border);
    max.add(border.multiplyScalar(2));
    var viewBoxTxt = min.x + " " + min.z + " " + max.x + " " + max.z;

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', viewBoxTxt);
    for (var i=0; i<rawFold.edges_vertices.length; i++){
        var line = document.createElementNS(ns, 'line');
        var edge = rawFold.edges_vertices[i];
        var vertex = rawFold.vertices_coords[edge[0]];
        line.setAttribute('stroke', colorForAssignment(rawFold.edges_assignment[i]));
        line.setAttribute('opacity', opacityForAngle(rawFold.edges_foldAngles[i], rawFold.edges_assignment[i]));
        line.setAttribute('x1', vertex[0]);
        line.setAttribute('y1', vertex[2]);
        vertex = rawFold.vertices_coords[edge[1]];
        line.setAttribute('x2', vertex[0]);
        line.setAttribute('y2', vertex[2]);
        line.setAttribute('stroke-width', strokeWidth);
        svg.appendChild(line);
    }
    $("#svgViewer").html(svg);
}

function parseSVG(pattern, _verticesRaw, _bordersRaw, _mountainsRaw, _valleysRaw, _cutsRaw, _triangulationsRaw, _hingesRaw){
    foldData = pattern.foldData;
    _.each(_verticesRaw, function(vertex){
        foldData.vertices_coords.push([vertex.x, vertex.z]);
    });
    _.each(_bordersRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]]);
        foldData.edges_assignment.push("B");
        foldData.edges_foldAngles.push(null);
    });
    _.each(_mountainsRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]]);
        foldData.edges_assignment.push("M");
        foldData.edges_foldAngles.push(edge[2]);
    });
    _.each(_valleysRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]]);
        foldData.edges_assignment.push("V");
        foldData.edges_foldAngles.push(edge[2]);
    });
    _.each(_triangulationsRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]]);
        foldData.edges_assignment.push("F");
        foldData.edges_foldAngles.push(0);
    });
    _.each(_hingesRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]]);
        foldData.edges_assignment.push("U");
        foldData.edges_foldAngles.push(null);
    });
    _.each(_cutsRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]]);
        foldData.edges_assignment.push("C");
        foldData.edges_foldAngles.push(null);
    });

    if (foldData.vertices_coords.length == 0 || foldData.edges_vertices.length == 0){
        console.warn("No valid geometry found in SVG, be sure to ungroup all and remove all clipping masks.");
        return false;
    }
    pattern.foldData = foldData;
    pattern.collapseTriangulate();
}


function getOpacity(obj){
    var opacity = obj.attr("opacity");
    if (opacity === undefined) {
        if (obj.attr("style") && $(obj)[0].style.opacity) {
            opacity = $(obj)[0].style.opacity;
        }
        if (opacity === undefined){
            opacity = obj.attr("stroke-opacity");
            if (opacity === undefined) {
                if (obj.attr("style") && $(obj)[0].style["stroke-opacity"]) {
                    opacity = $(obj)[0].style["stroke-opacity"];
                }
            }
        }
    }
    opacity = parseFloat(opacity);
    if (isNaN(opacity)) return 1;
    return opacity;
}

function getStroke(obj){
    var stroke = obj.attr("stroke");
    if (stroke === undefined) {
        if (obj.attr("style") && $(obj)[0].style.stroke) {
            stroke = ($(obj)[0].style.stroke).toLowerCase();
            stroke = stroke.replace(/\s/g,'');//remove all whitespace
            return stroke;
        }
        return null;
    }
    stroke = stroke.replace(/\s/g,'');//remove all whitespace
    return stroke.toLowerCase();
}

function typeForStroke(stroke){
    if (stroke == "#000000" || stroke == "#000" || stroke == "black" || stroke == "rgb(0,0,0)") return "border";
    if (stroke == "#ff0000" || stroke == "#f00" || stroke == "red" || stroke == "rgb(255,0,0)") return "mountain";
    if (stroke == "#0000ff" || stroke == "#00f" || stroke == "blue" || stroke == "rgb(0,0,255)") return "valley";
    if (stroke == "#00ff00" || stroke == "#0f0" || stroke == "green" || stroke == "rgb(0,255,0)") return "cut";
    if (stroke == "#ffff00" || stroke == "#ff0" || stroke == "yellow" || stroke == "rgb(255,255,0)") return "triangulation";
    if (stroke == "#ff00ff" || stroke == "#f0f" || stroke == "magenta" || stroke == "rgb(255,0,255)") return "hinge";
    badColors.push(stroke);
    return null;
}

function colorForAssignment(assignment){
    if (assignment == "B") return "#000";//border
    if (assignment == "M") return "#f00";//mountain
    if (assignment == "V") return "#00f";//valley
    if (assignment == "C") return "#0f0";//cut
    if (assignment == "F") return "#ff0";//facet
    if (assignment == "U") return "#f0f";//hinge
    return "#0ff";
}
function opacityForAngle(angle, assignment){
    if (angle === null || assignment == "F") return 1;
    return Math.abs(angle)/Math.PI;
}



function findType(pattern, _segmentsRaw, filter, paths, lines, rects, polygons, polylines){
    pattern.parsePath(pattern.verticesRaw, _segmentsRaw, paths.filter(filter));
    pattern.parseLine(pattern.verticesRaw, _segmentsRaw, lines.filter(filter));
    pattern.parseRect(pattern.verticesRaw, _segmentsRaw, rects.filter(filter));
    pattern.parsePolygon(pattern.verticesRaw, _segmentsRaw, polygons.filter(filter));
    pattern.parsePolyline(pattern.verticesRaw, _segmentsRaw, polylines.filter(filter));
}
