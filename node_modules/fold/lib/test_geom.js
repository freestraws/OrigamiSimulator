var a, ang, array, c, f, geom, i, j, k, l, len, len1, len10, len2, len3, len4, len5, len6, len7, len8, len9, m, n, o, old, p, print, ps1, ps2, q, r, ref, ref1, ref2, ref3, ref4, ref5, result, rs, s, t, ts, u, v, vs, w, x, y, z;

geom = require('./geom');

print = function(str) {
  return console.log(str);
};

print("Running tests on Geom Library:\n");

print("\n---- Running tests on Utilities ----");

print("\nTesting reducers...");

array = [-3, -2, -1, 0, 1, 2, 3, 14, -5, 6, 7];

print("Testing array = [" + array + "]");

ref = ['sum', 'min', 'max'];
for (j = 0, len = ref.length; j < len; j++) {
  f = ref[j];
  print("array.reduce(geom." + f + ") = " + (array.reduce(geom[f])));
}

print("\nTesting geom.Next...");

print("geom.next(5, 7) = " + (geom.next(5, 7)));

for (i = l = 0; l <= 4; i = ++l) {
  print("geom.next(5, 7, " + i + ") = " + (geom.next(5, 7, i)));
}

print("\nTesting geom.rangesDisjoint...");

rs = [
  {
    a: [5, 9],
    b: [2, 7]
  }, {
    a: [3, 1],
    b: [5, 8]
  }, {
    a: [4.5, 1],
    b: [4.5, 8]
  }
];

for (m = 0, len1 = rs.length; m < len1; m++) {
  r = rs[m];
  print(("geom.rangesDisjoint([" + r.a + "],[" + r.b + "]) = ") + ("" + (geom.rangesDisjoint(r.a, r.b))));
}

print("\nExample for geom.topologicalSort pending.");

print("\n---- Running tests on Vector Operations ----");

vs = {
  a: [1, 0, 0, 0],
  b: [1, 1, 1, 1],
  c: [0, 3, 2, 4],
  d: [0, 0, 0, 0],
  e: [0, 1.5, 1, 2]
};

for (k in vs) {
  v = vs[k];
  print("Test vector " + k + " = [" + v + "]");
}

ref1 = ['magsq', 'mag', 'unit'];
for (n = 0, len2 = ref1.length; n < len2; n++) {
  f = ref1[n];
  print("\nTesting geom." + f + "...");
  for (k in vs) {
    v = vs[k];
    print("geom." + f + "(" + k + ") = " + (geom[f](v)));
  }
}

print("\nTesting geom.ang2D...");

for (k in vs) {
  v = vs[k];
  print("geom.ang2D([" + v.slice(0, 2) + "]) = " + (geom.ang2D(v.slice(0, 2))));
}

print("\nTesting geom.mul...");

ref2 = [-1, 0, 1, 2, 2.5, 3];
for (o = 0, len3 = ref2.length; o < len3; o++) {
  t = ref2[o];
  print("geom.mul(c," + t + ") = [" + (geom.mul(vs.c, t)) + "]");
}

print("\nTesting geom.linearInterpolate...");

for (t = p = 0.2; p <= 0.8; t = p += 0.2) {
  print(("geom.linearInterpolate(" + t + ",a,c) = ") + (" [" + (geom.linearInterpolate(t, vs.a, vs.c)) + "]"));
}

print("\nTesting Binary Vector Operators");

ref3 = ['plus', 'sub', 'dot', 'distsq', 'dist', 'dir', 'ang', 'cross', 'parallel'];
for (q = 0, len4 = ref3.length; q < len4; q++) {
  f = ref3[q];
  print("\nTesting geom." + f + "...");
  for (k in vs) {
    v = vs[k];
    if (!(k !== 'c')) {
      continue;
    }
    result = geom[f](vs.c, v);
    if ((result != null) && result.length > 1) {
      print("geom." + f + "(c," + k + ") = [" + result + "]");
    } else {
      print("geom." + f + "(c," + k + ") = " + result);
    }
  }
}

print("\nTesting geom.rotate...");

ang = [0, Math.PI / 8, Math.PI / 3];

for (k in vs) {
  v = vs[k];
  if (k !== 'c') {
    for (s = 0, len5 = ang.length; s < len5; s++) {
      a = ang[s];
      print("geom.rotate(" + k + ",c," + a + ") = [" + (geom.rotate(v, vs.c, a)) + "]");
    }
  }
}

print("geom.rotate(c,d," + ang[1] + ") = [" + (geom.rotate(vs.c, vs.d, ang[1])) + "]");

print("\n---- Running tests on Polygon Operations ----");

print("\nTesting 2D Triangle Operations");

ts = [
  {
    a: [5, 9],
    b: [2, 7],
    c: [1, 7]
  }, {
    a: [3, 1],
    b: [5, 8],
    c: [0, 3]
  }, {
    a: [4.5, 1],
    b: [4.5, 8],
    c: [2, 5]
  }
];

ref4 = ['interiorAngle', 'turnAngle'];
for (u = 0, len6 = ref4.length; u < len6; u++) {
  f = ref4[u];
  print("\nTesting geom." + f + "...");
  for (w = 0, len7 = ts.length; w < len7; w++) {
    t = ts[w];
    result = geom[f](t.a, t.b, t.c);
    if ((result != null) && result.length > 1) {
      print("geom." + f + "([" + t.a + "],[" + t.b + "],[" + t.c + "]) = [" + result + "]");
    } else {
      print("geom." + f + "([" + t.a + "],[" + t.b + "],[" + t.c + "]) = " + result);
    }
  }
}

print("\nTesting 3D Triangle Operations");

ts = [
  {
    a: [1, 0, 0],
    b: [0, 1, 0],
    c: [0, 0, 1]
  }, {
    a: [2, 0, 1],
    b: [1, 1, 1],
    c: [-1, -1, 0]
  }, {
    a: [3, 4, 0],
    b: [-1, 2, -3],
    c: [0, 3, 2]
  }, {
    a: [0, 0, 0],
    b: [1, 0, 0],
    c: [2, 0, 0]
  }
];

print("\nTesting geom.triangleNormal...");

for (x = 0, len8 = ts.length; x < len8; x++) {
  t = ts[x];
  print(("geom.triangleNormal([" + t.a + "],[" + t.b + "],[" + t.c + "]) = ") + ("[" + (geom.triangleNormal(t.a, t.b, t.c)) + "]"));
}

print("\nTesting 2D Polygon Operations");

ts = [[[5, 9], [2, 7], [1, 7]], [[0, 3], [5, 8], [3, 1]], [[4.5, 1], [4.5, 8], [2, 5]], [[1, 7], [0, 4], [5, 9], [2, 7]], [[0, 3], [-1, 5], [3, 1], [5, 8]], [[4.5, 1], [4.5, 8], [2, 5], [3.5, 3]]];

ref5 = ['twiceSignedArea', 'polygonOrientation', 'sortByAngle'];
for (y = 0, len9 = ref5.length; y < len9; y++) {
  f = ref5[y];
  print("\nTesting geom." + f + "...");
  for (z = 0, len10 = ts.length; z < len10; z++) {
    t = ts[z];
    old = (function() {
      var i1, len11, results;
      results = [];
      for (i1 = 0, len11 = t.length; i1 < len11; i1++) {
        c = t[i1];
        results.push(c);
      }
      return results;
    })();
    result = geom[f](t);
    if ((result != null) && result.length > 1) {
      print("geom." + f + "([" + ((function() {
        var i1, len11, results;
        results = [];
        for (i1 = 0, len11 = old.length; i1 < len11; i1++) {
          c = old[i1];
          results.push("[" + c + "]");
        }
        return results;
      })()) + "]) = [" + ((function() {
        var i1, len11, results;
        results = [];
        for (i1 = 0, len11 = result.length; i1 < len11; i1++) {
          r = result[i1];
          results.push("[" + r + "]");
        }
        return results;
      })()) + "]");
    } else {
      print("geom." + f + "([" + ((function() {
        var i1, len11, results;
        results = [];
        for (i1 = 0, len11 = old.length; i1 < len11; i1++) {
          c = old[i1];
          results.push("[" + c + "]");
        }
        return results;
      })()) + "]) = " + result);
    }
  }
}

print('\nSkipping segmentsCross(), parametricLineIntersect(), segmentLineIntersect(), lineIntersectLine(), and pointStrictlyInSegment()');

print("\nTesting General Dimension Point Operations");

ps1 = [[0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

ps2 = [[0, 0, 0], [1, 1, 0], [0, 1, 1]];

print("ps1 = [" + ps1 + "]");

print("ps2 = [" + ps2 + "]");

print("geom.centroid(ps1) = [" + (geom.centroid(ps1)) + "]");

print("geom.centroid(ps2) = [" + (geom.centroid(ps2)) + "]");

print("geom.basis(ps1) = " + (geom.basis(ps1).length) + ": [" + (geom.basis(ps1)) + "]");

print("geom.basis(ps2) = " + (geom.basis(ps2).length) + ": [" + (geom.basis(ps2)) + "]");
