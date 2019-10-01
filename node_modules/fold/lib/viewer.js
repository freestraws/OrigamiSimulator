var DEFAULTS, STYLES, SVGNS, geom, viewer;

geom = require('./geom');

viewer = exports;

STYLES = {
  vert: "fill: white; r: 0.03; stroke: black; stroke-width: 0.005;",
  face: "stroke: none; fill-opacity: 0.8;",
  top: "fill: cyan;",
  bot: "fill: yellow;",
  edge: "fill: none; stroke-width: 0.01; stroke-linecap: round;",
  axis: "fill: none; stroke-width: 0.01; stroke-linecap: round;",
  text: "fill: black; font-size: 0.04; text-anchor: middle; font-family: sans-serif;",
  B: "stroke: black;",
  V: "stroke: blue;",
  M: "stroke: red;",
  U: "stroke: white;",
  F: "stroke: gray;",
  ax: "stroke: blue;",
  ay: "stroke: red;",
  az: "stroke: green;"
};


/* UTILITIES */

viewer.setAttrs = function(el, attrs) {
  var k, v;
  for (k in attrs) {
    v = attrs[k];
    el.setAttribute(k, v);
  }
  return el;
};

viewer.appendHTML = function(el, tag, attrs) {
  return el.appendChild(viewer.setAttrs(document.createElement(tag), attrs));
};

SVGNS = 'http://www.w3.org/2000/svg';

viewer.appendSVG = function(el, tag, attrs) {
  return el.appendChild(viewer.setAttrs(document.createElementNS(SVGNS, tag), attrs));
};

viewer.makePath = function(coords) {
  var c, i;
  return ((function() {
    var l, len, results;
    results = [];
    for (i = l = 0, len = coords.length; l < len; i = ++l) {
      c = coords[i];
      results.push((i === 0 ? 'M' : 'L') + " " + c[0] + " " + c[1] + " ");
    }
    return results;
  })()).reduce(geom.sum);
};


/* INTERFACE */

viewer.processInput = function(input, view) {
  var k;
  if (typeof input === 'string') {
    view.fold = JSON.parse(input);
  } else {
    view.fold = input;
  }
  view.model = viewer.makeModel(view.fold);
  viewer.addRotation(view);
  viewer.draw(view);
  viewer.update(view);
  if (view.opts.properties) {
    view.properties.innerHTML = '';
    for (k in view.fold) {
      if (view.opts.properties) {
        viewer.appendHTML(view.properties, 'option', {
          value: k
        }).innerHTML = k;
      }
    }
    return viewer.updateProperties(view);
  }
};

viewer.updateProperties = function(view) {
  var s, v;
  v = view.fold[view.properties.value];
  s = v.length != null ? v.length + " elements: " : '';
  return view.data.innerHTML = s + JSON.stringify(v);
};

viewer.importURL = function(url, view) {
  var xhr;
  xhr = new XMLHttpRequest();
  xhr.onload = (function(_this) {
    return function(e) {
      return viewer.processInput(e.target.responseText, view);
    };
  })(this);
  xhr.open('GET', url);
  return xhr.send();
};

viewer.importFile = function(file, view) {
  var file_reader;
  file_reader = new FileReader();
  file_reader.onload = (function(_this) {
    return function(e) {
      return viewer.processInput(e.target.result, view);
    };
  })(this);
  return file_reader.readAsText(file);
};

DEFAULTS = {
  viewButtons: true,
  axisButtons: true,
  attrViewer: true,
  examples: false,
  "import": true,
  "export": true,
  properties: true
};

viewer.addViewer = function(div, opts) {
  var buttonDiv, i, inputDiv, k, l, len, ref, ref1, ref2, select, t, title, toggleDiv, url, v, val, view;
  if (opts == null) {
    opts = {};
  }
  view = {
    cam: viewer.initCam(),
    opts: DEFAULTS
  };
  for (k in opts) {
    v = opts[k];
    view.opts[k] = v;
  }
  if (view.opts.viewButtons) {
    toggleDiv = viewer.appendHTML(div, 'div');
    toggleDiv.innerHtml = '';
    toggleDiv.innerHtml += 'Toggle: ';
    ref = view.cam.show;
    for (k in ref) {
      v = ref[k];
      t = viewer.appendHTML(toggleDiv, 'input', {
        type: 'checkbox',
        value: k
      });
      if (v) {
        t.setAttribute('checked', '');
      }
      toggleDiv.innerHTML += k + ' ';
    }
  }
  if (view.opts.axisButtons) {
    buttonDiv = viewer.appendHTML(div, 'div');
    buttonDiv.innerHTML += 'View: ';
    ref1 = ['x', 'y', 'z'];
    for (i = l = 0, len = ref1.length; l < len; i = ++l) {
      val = ref1[i];
      viewer.appendHTML(buttonDiv, 'input', {
        type: 'button',
        value: val
      });
    }
  }
  if (view.opts.properties) {
    buttonDiv.innerHTML += ' Property:';
    view.properties = viewer.appendHTML(buttonDiv, 'select');
    view.data = viewer.appendHTML(buttonDiv, 'div', {
      style: 'width: 300; padding: 10px; overflow: auto; border: 1px solid black; display: inline-block; white-space: nowrap;'
    });
  }
  if (view.opts.examples || view.opts["import"]) {
    inputDiv = viewer.appendHTML(div, 'div');
    if (view.opts.examples) {
      inputDiv.innerHTML = 'Example: ';
      select = viewer.appendHTML(inputDiv, 'select');
      ref2 = view.opts.examples;
      for (title in ref2) {
        url = ref2[title];
        viewer.appendHTML(select, 'option', {
          value: url
        }).innerHTML = title;
      }
      viewer.importURL(select.value, view);
    }
    if (view.opts["import"]) {
      inputDiv.innerHTML += ' Import: ';
      viewer.appendHTML(inputDiv, 'input', {
        type: 'file'
      });
    }
  }
  div.onclick = (function(_this) {
    return function(e) {
      if (e.target.type === 'checkbox') {
        if (e.target.hasAttribute('checked')) {
          e.target.removeAttribute('checked');
        } else {
          e.target.setAttribute('checked', '');
        }
        view.cam.show[e.target.value] = e.target.hasAttribute('checked');
        viewer.update(view);
      }
      if (e.target.type === 'button') {
        switch (e.target.value) {
          case 'x':
            viewer.setCamXY(view.cam, [0, 1, 0], [0, 0, 1]);
            break;
          case 'y':
            viewer.setCamXY(view.cam, [0, 0, 1], [1, 0, 0]);
            break;
          case 'z':
            viewer.setCamXY(view.cam, [1, 0, 0], [0, 1, 0]);
        }
        return viewer.update(view);
      }
    };
  })(this);
  div.onchange = (function(_this) {
    return function(e) {
      if (e.target.type === 'file') {
        viewer.importFile(e.target.files[0], view);
      }
      if (e.target.type === 'select-one') {
        if (e.target === view.properties) {
          return viewer.updateProperties(view);
        } else {
          return viewer.importURL(e.target.value, view);
        }
      }
    };
  })(this);
  view.svg = viewer.appendSVG(div, 'svg', {
    xmlns: SVGNS,
    width: 600
  });
  return view;
};


/* CAMERA */

viewer.initCam = function() {
  return {
    c: [0, 0, 0],
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
    r: 1,
    last: null,
    show: {
      'Faces': true,
      'Edges': true,
      'Vertices': false,
      'Face Text': false
    }
  };
};

viewer.proj = function(p, cam) {
  var q;
  q = geom.mul(geom.sub(p, cam.c), 1 / cam.r);
  return [geom.dot(q, cam.x), -geom.dot(q, cam.y), 0];
};

viewer.setCamXY = function(cam, x, y) {
  var ref;
  return ref = [x, y, geom.cross(x, y)], cam.x = ref[0], cam.y = ref[1], cam.z = ref[2], ref;
};

viewer.addRotation = function(view) {
  var cam, l, len, ref, s, svg;
  svg = view.svg, cam = view.cam;
  ref = ['contextmenu', 'selectstart', 'dragstart'];
  for (l = 0, len = ref.length; l < len; l++) {
    s = ref[l];
    svg["on" + s] = function(e) {
      return e.preventDefault();
    };
  }
  svg.onmousedown = (function(_this) {
    return function(e) {
      return cam.last = [e.clientX, e.clientY];
    };
  })(this);
  svg.onmousemove = (function(_this) {
    return function(e) {
      return viewer.rotateCam([e.clientX, e.clientY], view);
    };
  })(this);
  return svg.onmouseup = (function(_this) {
    return function(e) {
      viewer.rotateCam([e.clientX, e.clientY], view);
      return cam.last = null;
    };
  })(this);
};

viewer.rotateCam = function(p, view) {
  var cam, d, e, ref, u, x, y;
  cam = view.cam;
  if (cam.last == null) {
    return;
  }
  d = geom.sub(p, cam.last);
  if (!geom.mag(d) > 0) {
    return;
  }
  u = geom.unit(geom.plus(geom.mul(cam.x, -d[1]), geom.mul(cam.y, -d[0])));
  ref = (function() {
    var l, len, ref, results;
    ref = ['x', 'y'];
    results = [];
    for (l = 0, len = ref.length; l < len; l++) {
      e = ref[l];
      results.push(geom.rotate(cam[e], u, geom.mag(d) * 0.01));
    }
    return results;
  })(), x = ref[0], y = ref[1];
  viewer.setCamXY(cam, x, y);
  cam.last = p;
  return viewer.update(view);
};


/* RENDERING */

viewer.makeModel = function(fold) {
  var a, as, b, cs, edge, f, f1, f2, i, i1, j, j1, k1, l, len, len1, len2, len3, len4, len5, m, normRel, o, r, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, v, vs, w, z;
  m = {
    vs: null,
    fs: null,
    es: {}
  };
  m.vs = (function() {
    var l, len, ref, results;
    ref = fold.vertices_coords;
    results = [];
    for (i = l = 0, len = ref.length; l < len; i = ++l) {
      cs = ref[i];
      results.push({
        i: i,
        cs: cs
      });
    }
    return results;
  })();
  ref = m.vs;
  for (i = l = 0, len = ref.length; l < len; i = ++l) {
    v = ref[i];
    if (v.cs.length === 2) {
      m.vs[i].cs[2] = 0;
    }
  }
  m.fs = (function() {
    var len1, r, ref1, results;
    ref1 = fold.faces_vertices;
    results = [];
    for (i = r = 0, len1 = ref1.length; r < len1; i = ++r) {
      vs = ref1[i];
      results.push({
        i: i,
        vs: (function() {
          var len2, results1, z;
          results1 = [];
          for (z = 0, len2 = vs.length; z < len2; z++) {
            v = vs[z];
            results1.push(m.vs[v]);
          }
          return results1;
        })()
      });
    }
    return results;
  })();
  if (fold.edges_vertices != null) {
    ref1 = fold.edges_vertices;
    for (i = r = 0, len1 = ref1.length; r < len1; i = ++r) {
      v = ref1[i];
      ref2 = v[0] > v[1] ? [v[1], v[0]] : [v[0], v[1]], a = ref2[0], b = ref2[1];
      as = ((ref3 = fold.edges_assignment) != null ? ref3[i] : void 0) != null ? fold.edges_assignment[i] : 'U';
      m.es["e" + a + "e" + b] = {
        v1: m.vs[a],
        v2: m.vs[b],
        as: as
      };
    }
  } else {
    ref4 = m.fs;
    for (i = z = 0, len2 = ref4.length; z < len2; i = ++z) {
      f = ref4[i];
      ref5 = f.vs;
      for (j = i1 = 0, len3 = ref5.length; i1 < len3; j = ++i1) {
        v = ref5[j];
        w = f.vs[geom.next(j, f.vs.length)];
        ref6 = v.i > w.i ? [w, v] : [v, w], a = ref6[0], b = ref6[1];
        m.es["e" + a.i + "e" + b.i] = {
          v1: a,
          v2: b,
          as: 'U'
        };
      }
    }
  }
  ref7 = m.fs;
  for (i = j1 = 0, len4 = ref7.length; j1 < len4; i = ++j1) {
    f = ref7[i];
    m.fs[i].n = geom.polygonNormal((function() {
      var k1, len5, ref8, results;
      ref8 = f.vs;
      results = [];
      for (k1 = 0, len5 = ref8.length; k1 < len5; k1++) {
        v = ref8[k1];
        results.push(v.cs);
      }
      return results;
    })());
    m.fs[i].c = geom.centroid((function() {
      var k1, len5, ref8, results;
      ref8 = f.vs;
      results = [];
      for (k1 = 0, len5 = ref8.length; k1 < len5; k1++) {
        v = ref8[k1];
        results.push(v.cs);
      }
      return results;
    })());
    m.fs[i].es = {};
    m.fs[i].es = (function() {
      var k1, len5, ref8, ref9, results;
      ref8 = f.vs;
      results = [];
      for (j = k1 = 0, len5 = ref8.length; k1 < len5; j = ++k1) {
        v = ref8[j];
        w = f.vs[geom.next(j, f.vs.length)];
        ref9 = v.i > w.i ? [w, v] : [v, w], a = ref9[0], b = ref9[1];
        edge = m.es["e" + a.i + "e" + b.i];
        if (edge == null) {
          edge = {
            v1: a,
            v2: b,
            as: 'U'
          };
        }
        results.push(edge);
      }
      return results;
    })();
    m.fs[i].ord = {};
  }
  if (fold.faceOrders != null) {
    ref8 = fold.faceOrders;
    for (k1 = 0, len5 = ref8.length; k1 < len5; k1++) {
      ref9 = ref8[k1], f1 = ref9[0], f2 = ref9[1], o = ref9[2];
      if (o !== 0) {
        if (geom.parallel(m.fs[f1].n, m.fs[f2].n)) {
          normRel = geom.dot(m.fs[f1].n, m.fs[f2].n) > 0 ? 1 : -1;
          if (m.fs[f1].ord["f" + f2] != null) {
            console.log("Warning: duplicate ordering input information for faces " + f1 + " and " + f2 + ". Using first found in the faceOrder list.");
            if (m.fs[f1].ord["f" + f2] !== o) {
              console.log("Error: duplicat ordering [" + f1 + "," + f2 + "," + o + "] is inconsistant with a previous entry.");
            }
          } else {
            m.fs[f1].ord["f" + f2] = o;
            m.fs[f2].ord["f" + f1] = -o * normRel;
          }
        } else {
          console.log("Warning: order for non-parallel faces [" + f1 + "," + f2 + "]");
        }
      }
    }
  }
  return m;
};

viewer.faceAbove = function(f1, f2, n) {
  var basis, dir, f, ord, p1, p2, ref, ref1, sepDir, v, v1, v2;
  ref = (function() {
    var l, len, ref, results;
    ref = [f1, f2];
    results = [];
    for (l = 0, len = ref.length; l < len; l++) {
      f = ref[l];
      results.push((function() {
        var len1, r, ref1, results1;
        ref1 = f.vs;
        results1 = [];
        for (r = 0, len1 = ref1.length; r < len1; r++) {
          v = ref1[r];
          results1.push(v.ps);
        }
        return results1;
      })());
    }
    return results;
  })(), p1 = ref[0], p2 = ref[1];
  sepDir = geom.separatingDirection2D(p1, p2, [0, 0, 1]);
  if (sepDir != null) {
    return null;
  }
  ref1 = (function() {
    var l, len, ref1, results;
    ref1 = [f1, f2];
    results = [];
    for (l = 0, len = ref1.length; l < len; l++) {
      f = ref1[l];
      results.push((function() {
        var len1, r, ref2, results1;
        ref2 = f.vs;
        results1 = [];
        for (r = 0, len1 = ref2.length; r < len1; r++) {
          v = ref2[r];
          results1.push(v.cs);
        }
        return results1;
      })());
    }
    return results;
  })(), v1 = ref1[0], v2 = ref1[1];
  basis = geom.basis(v1.concat(v2));
  if (basis.length === 3) {
    dir = geom.separatingDirection3D(v1, v2);
    if (dir != null) {
      return 0 > geom.dot(n, dir);
    } else {
      console.log("Warning: faces " + f1.i + " and " + f2.i + " properly intersect. Ordering is unresolved.");
    }
  }
  if (basis.length === 2) {
    ord = f1.ord["f" + f2.i];
    if (ord != null) {
      return 0 > geom.dot(f2.n, n) * ord;
    }
  }
  return null;
};

viewer.orderFaces = function(view) {
  var c, direction, f, f1, f1_above, f2, faces, i, i1, j, j1, l, len, len1, len2, len3, len4, p, r, ref, ref1, ref2, results, z;
  faces = view.model.fs;
  direction = geom.mul(view.cam.z, -1);
  for (l = 0, len = faces.length; l < len; l++) {
    f = faces[l];
    f.children = [];
  }
  for (i = r = 0, len1 = faces.length; r < len1; i = ++r) {
    f1 = faces[i];
    for (j = z = 0, len2 = faces.length; z < len2; j = ++z) {
      f2 = faces[j];
      if (!(i < j)) {
        continue;
      }
      f1_above = viewer.faceAbove(f1, f2, direction);
      if (f1_above != null) {
        ref = f1_above ? [f1, f2] : [f2, f1], p = ref[0], c = ref[1];
        p.children = p.children.concat([c]);
      }
    }
  }
  view.model.fs = geom.topologicalSort(faces);
  ref1 = view.model.fs;
  for (i1 = 0, len3 = ref1.length; i1 < len3; i1++) {
    f = ref1[i1];
    f.g.parentNode.removeChild(f.g);
  }
  ref2 = view.model.fs;
  results = [];
  for (j1 = 0, len4 = ref2.length; j1 < len4; j1++) {
    f = ref2[j1];
    results.push(view.svg.appendChild(f.g));
  }
  return results;
};

viewer.draw = function(arg) {
  var c, cam, e, f, i, i1, j, k, l, len, len1, len2, len3, max, min, model, r, ref, ref1, ref2, ref3, results, style, svg, t, v, z;
  svg = arg.svg, cam = arg.cam, model = arg.model;
  svg.innerHTML = '';
  style = viewer.appendSVG(svg, 'style');
  for (k in STYLES) {
    v = STYLES[k];
    style.innerHTML += "." + k + "{" + v + "}\n";
  }
  min = (function() {
    var l, len, ref, results;
    ref = [0, 1, 2];
    results = [];
    for (l = 0, len = ref.length; l < len; l++) {
      i = ref[l];
      results.push(((function() {
        var len1, r, ref1, results1;
        ref1 = model.vs;
        results1 = [];
        for (r = 0, len1 = ref1.length; r < len1; r++) {
          v = ref1[r];
          results1.push(v.cs[i]);
        }
        return results1;
      })()).reduce(geom.min));
    }
    return results;
  })();
  max = (function() {
    var l, len, ref, results;
    ref = [0, 1, 2];
    results = [];
    for (l = 0, len = ref.length; l < len; l++) {
      i = ref[l];
      results.push(((function() {
        var len1, r, ref1, results1;
        ref1 = model.vs;
        results1 = [];
        for (r = 0, len1 = ref1.length; r < len1; r++) {
          v = ref1[r];
          results1.push(v.cs[i]);
        }
        return results1;
      })()).reduce(geom.max));
    }
    return results;
  })();
  cam.c = geom.mul(geom.plus(min, max), 0.5);
  cam.r = geom.mag(geom.sub(max, min)) / 2 * 1.05;
  c = viewer.proj(cam.c, cam);
  viewer.setAttrs(svg, {
    viewBox: "-1,-1,2,2"
  });
  t = "translate(0,0.01)";
  ref = model.fs;
  for (i = l = 0, len = ref.length; l < len; i = ++l) {
    f = ref[i];
    f.g = viewer.appendSVG(svg, 'g');
    f.path = viewer.appendSVG(f.g, 'path');
    f.text = viewer.appendSVG(f.g, 'text', {
      "class": 'text',
      transform: t
    });
    f.text.innerHTML = "f" + f.i;
    f.eg = [];
    ref1 = f.es;
    for (j = r = 0, len1 = ref1.length; r < len1; j = ++r) {
      e = ref1[j];
      f.eg[j] = viewer.appendSVG(f.g, 'path');
    }
    f.vg = [];
    ref2 = f.vs;
    for (j = z = 0, len2 = ref2.length; z < len2; j = ++z) {
      v = ref2[j];
      f.vg[j] = viewer.appendSVG(f.g, 'g');
      f.vg[j].path = viewer.appendSVG(f.vg[j], 'circle', {
        "class": 'vert'
      });
      f.vg[j].text = viewer.appendSVG(f.vg[j], 'text', {
        transform: 'translate(0, 0.01)',
        "class": 'text'
      });
      f.vg[j].text.innerHTML = "" + v.i;
    }
  }
  cam.axis = viewer.appendSVG(svg, 'g', {
    transform: 'translate(-0.9,-0.9)'
  });
  ref3 = ['x', 'y', 'z'];
  results = [];
  for (i1 = 0, len3 = ref3.length; i1 < len3; i1++) {
    c = ref3[i1];
    results.push(cam.axis[c] = viewer.appendSVG(cam.axis, 'path', {
      id: "a" + c,
      "class": "a" + c + " axis"
    }));
  }
  return results;
};

viewer.update = function(view) {
  var c, cam, e, end, f, i, i1, j, j1, k, l, len, len1, len2, len3, len4, model, p, r, ref, ref1, ref2, ref3, ref4, ref5, ref6, results, show, svg, v, visibleSide, z;
  model = view.model, cam = view.cam, svg = view.svg;
  ref = model.vs;
  for (i = l = 0, len = ref.length; l < len; i = ++l) {
    v = ref[i];
    model.vs[i].ps = viewer.proj(v.cs, cam);
  }
  ref1 = model.fs;
  for (i = r = 0, len1 = ref1.length; r < len1; i = ++r) {
    f = ref1[i];
    model.fs[i].c2 = viewer.proj(f.c, cam);
  }
  viewer.orderFaces(view);
  show = {};
  ref2 = cam.show;
  for (k in ref2) {
    v = ref2[k];
    show[k] = v ? 'visible' : 'hidden';
  }
  ref3 = model.fs;
  for (i = z = 0, len2 = ref3.length; z < len2; i = ++z) {
    f = ref3[i];
    if (!(f.path != null)) {
      continue;
    }
    visibleSide = geom.dot(f.n, cam.z) > 0 ? 'top' : 'bot';
    viewer.setAttrs(f.text, {
      x: f.c2[0],
      y: f.c2[1],
      visibility: show['Face Text']
    });
    viewer.setAttrs(f.path, {
      d: viewer.makePath((function() {
        var i1, len3, ref4, results;
        ref4 = f.vs;
        results = [];
        for (i1 = 0, len3 = ref4.length; i1 < len3; i1++) {
          v = ref4[i1];
          results.push(v.ps);
        }
        return results;
      })()) + 'Z',
      visibility: show['Faces'],
      "class": "face " + visibleSide
    });
    ref4 = f.es;
    for (j = i1 = 0, len3 = ref4.length; i1 < len3; j = ++i1) {
      e = ref4[j];
      viewer.setAttrs(f.eg[j], {
        d: viewer.makePath([e.v1.ps, e.v2.ps]),
        visibility: show['Edges'],
        "class": "edge " + e.as
      });
    }
    ref5 = f.vs;
    for (j = j1 = 0, len4 = ref5.length; j1 < len4; j = ++j1) {
      v = ref5[j];
      viewer.setAttrs(f.vg[j], {
        visibility: show['Vertices']
      });
      viewer.setAttrs(f.vg[j].path, {
        cx: v.ps[0],
        cy: v.ps[1]
      });
      viewer.setAttrs(f.vg[j].text, {
        x: v.ps[0],
        y: v.ps[1]
      });
    }
  }
  ref6 = {
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1]
  };
  results = [];
  for (c in ref6) {
    v = ref6[c];
    end = geom.plus(geom.mul(v, 0.05 * cam.r), cam.c);
    results.push(viewer.setAttrs(cam.axis[c], {
      d: viewer.makePath((function() {
        var k1, len5, ref7, results1;
        ref7 = [cam.c, end];
        results1 = [];
        for (k1 = 0, len5 = ref7.length; k1 < len5; k1++) {
          p = ref7[k1];
          results1.push(viewer.proj(p, cam));
        }
        return results1;
      })())
    }));
  }
  return results;
};
