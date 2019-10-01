const THREE = require("three")
const pattern = require("./pattern")
const FOLD = require('fold')

module.exports.load = function(data){
    var p = new pattern.Pattern()
    p.clearAll()

    var paths = data.find("path")
    var lines = data.find("line")
    var rects = data.find("rect")
    var polygons = data.find("polygon")
    var polylines = data.find("polyline")
    // paths.css({fill:"none", 'stroke-dasharray':"none"})
    // lines.css({fill:"none", 'stroke-dasharray':"none"})
    // rects.css({fill:"none", 'stroke-dasharray':"none"})
    // polygons.css({fill:"none", 'stroke-dasharray':"none"})
    // polylines.css({fill:"none", 'stroke-dasharray':"none"})

    pattern.findType(pattern.verticesRaw, pattern.bordersRaw, pattern.filters.border, paths, lines, rects, polygons, polylines)
    pattern.findType(pattern.verticesRaw, pattern.mountainsRaw, pattern.filters.mountain, paths, lines, rects, polygons, polylines)
    pattern.findType(pattern.verticesRaw, pattern.valleysRaw, pattern.filters.valley, paths, lines, rects, polygons, polylines)
    pattern.findType(pattern.verticesRaw, pattern.cutsRaw, pattern.filters.cut, paths, lines, rects, polygons, polylines)
    pattern.findType(pattern.verticesRaw, pattern.triangulationsRaw, pattern.filters.triangulation, paths, lines, rects, polygons, polylines)
    pattern.findType(pattern.verticesRaw, pattern.hingesRaw, pattern.filters.hinge, paths, lines, rects, polygons, polylines)

    badColors = pattern.badColors

    if (badColors.length>0){
        badColors = _.uniq(badColors)
        var string = "Some objects found with the following stroke colors:<br/><br/>"
        _.each(badColors, function(color){
            string += "<span style='background:" + color + "' class='colorSwatch'></span>" + color + "<br/>"
        })
        string +=  "<br/>These objects were ignored.<br/>  Please check that your file is set up correctly, <br/>" +
            "see <b>File > File Import Tips</b> for more information."
        console.log(string)
    }

    //todo revert back to old pattern if bad import
    var success = parseSVG(pattern, pattern.verticesRaw, pattern.bordersRaw, pattern.mountainsRaw, pattern.valleysRaw, pattern.cutsRaw, pattern.triangulationsRaw, pattern.hingesRaw)
    if (!success) return

    //find max and min vertices
    var max = new THREE.Vector3(-Infinity,-Infinity,-Infinity)
    var min = new THREE.Vector3(Infinity,Infinity,Infinity)
    rawFold = pattern.rawFold
    for (var i=0; i<rawFold.vertices_coords.length; i++){
        var vertex = new THREE.Vector3(rawFold.vertices_coords[i][0], rawFold.vertices_coords[i][1], rawFold.vertices_coords[i][2])
        max.max(vertex)
        min.min(vertex)
    }
    if (min.x === Infinity){
        if (badColors.length == 0) console.log("no geometry found in file")
        return
    }
    max.sub(min)
    var border = new THREE.Vector3(0.1, 0, 0.1)
    var scale = max.x
    if (max.z < scale) scale = max.z
    if (scale == 0) return

    var strokeWidth = scale/300
    border.multiplyScalar(scale)
    min.sub(border)
    max.add(border.multiplyScalar(2))
    var viewBoxTxt = min.x + " " + min.z + " " + max.x + " " + max.z

    var ns = 'http://www.w3.org/2000/svg'
    var svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('viewBox', viewBoxTxt)
    for (var i=0; i<rawFold.edges_vertices.length; i++){
        var line = document.createElementNS(ns, 'line')
        var edge = rawFold.edges_vertices[i]
        var vertex = rawFold.vertices_coords[edge[0]]
        line.setAttribute('stroke', colorForAssignment(rawFold.edges_assignment[i]))
        line.setAttribute('opacity', opacityForAngle(rawFold.edges_foldAngles[i], rawFold.edges_assignment[i]))
        line.setAttribute('x1', vertex[0])
        line.setAttribute('y1', vertex[2])
        vertex = rawFold.vertices_coords[edge[1]]
        line.setAttribute('x2', vertex[0])
        line.setAttribute('y2', vertex[2])
        line.setAttribute('stroke-width', strokeWidth)
        svg.appendChild(line)
    }
    $("#svgViewer").html(svg)

}

function parseSVG(pattern, _verticesRaw, _bordersRaw, _mountainsRaw, _valleysRaw, _cutsRaw, _triangulationsRaw, _hingesRaw){
    foldData = pattern.foldData
    _.each(_verticesRaw, function(vertex){
        foldData.vertices_coords.push([vertex.x, vertex.z])
    })
    _.each(_bordersRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]])
        foldData.edges_assignment.push("B")
        foldData.edges_foldAngles.push(null)
    })
    _.each(_mountainsRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]])
        foldData.edges_assignment.push("M")
        foldData.edges_foldAngles.push(edge[2])
    })
    _.each(_valleysRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]])
        foldData.edges_assignment.push("V")
        foldData.edges_foldAngles.push(edge[2])
    })
    _.each(_triangulationsRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]])
        foldData.edges_assignment.push("F")
        foldData.edges_foldAngles.push(0)
    })
    _.each(_hingesRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]])
        foldData.edges_assignment.push("U")
        foldData.edges_foldAngles.push(null)
    })
    _.each(_cutsRaw, function(edge){
        foldData.edges_vertices.push([edge[0], edge[1]])
        foldData.edges_assignment.push("C")
        foldData.edges_foldAngles.push(null)
    })

    if (foldData.vertices_coords.length == 0 || foldData.edges_vertices.length == 0){
        globals.warn("No valid geometry found in SVG, be sure to ungroup all and remove all clipping masks.")
        return false
    }

    foldData = FOLD.filter.collapseNearbyVertices(foldData, globals.vertTol)
    foldData = FOLD.filter.removeLoopEdges(foldData) //remove edges that points to same vertex
    foldData = FOLD.filter.removeDuplicateEdges_vertices(foldData) //remove duplicate edges
    // foldData = FOLD.filter.subdivideCrossingEdges_vertices(foldData, globals.vertTol)//find intersections and add vertices/edges

    foldData = pattern.findIntersections(foldData, globals.vertTol)
    //cleanup after intersection operation
    foldData = FOLD.filter.collapseNearbyVertices(foldData, globals.vertTol)
    foldData = FOLD.filter.removeLoopEdges(foldData) //remove edges that points to same vertex
    foldData = FOLD.filter.removeDuplicateEdges_vertices(foldData) //remove duplicate edges

    foldData = FOLD.convert.edges_vertices_to_vertices_vertices_unsorted(foldData)
    foldData = pattern.removeStrayVertices(foldData) //delete stray anchors
    foldData = pattern.removeRedundantVertices(foldData, 0.01) //remove vertices that split edge

    foldData.vertices_vertices = FOLD.convert.sort_vertices_vertices(foldData)
    foldData = FOLD.convert.vertices_vertices_to_faces_vertices(foldData)

    foldData = pattern.edgesVerticesToVerticesEdges(foldData)
    foldData = pattern.removeBorderFaces(foldData) //expose holes surrounded by all border edges

    foldData = pattern.reverseFaceOrder(foldData) //set faces to counter clockwise

    return pattern.processFold(foldData)
}