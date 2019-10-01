#!/usr/bin/env node
;
var convert, file, fs, path;

fs = require('fs');

path = require('path');

convert = require('./convert');

file = exports;

file.extensionOf = function(filename) {
  var parsed;
  parsed = path.parse(filename);
  if (parsed.ext) {
    return parsed.ext;
  } else if (parsed.base[0] === '.') {
    return parsed.base;
  } else if (("." + filename) in convert.extensions) {
    return "." + filename;
  } else {
    return null;
  }
};

file.toFile = function(fold, output, converter) {
  var outFormat, result;
  if (converter == null) {
    converter = null;
  }
  outFormat = file.extensionOf(output);
  if (!outFormat) {
    console.warn("Could not detect extension of " + output);
    return;
  }
  if (converter == null) {
    converter = convert.getConverter('.fold', outFormat);
    if (converter == null) {
      console.warn("No converter from .fold to " + outFormat);
      return;
    }
  }
  result = converter(fold);
  if (typeof result !== 'string') {
    result = convert.toJSON(result);
  }
  return fs.writeFileSync(output, result, 'utf-8');
};

file.fileToFile = function(input, output, converter) {
  var inFormat, outFormat, result;
  if (converter == null) {
    converter = null;
  }
  inFormat = file.extensionOf(input);
  outFormat = file.extensionOf(output);
  if (!inFormat) {
    console.warn("Could not detect extension of " + input);
    return;
  }
  if (!outFormat) {
    console.warn("Could not detect extension of " + output);
    return;
  }
  if (converter == null) {
    converter = convert.getConverter(inFormat, outFormat);
    if (converter == null) {
      console.warn("No converter from " + inFormat + " to " + outFormat);
      return;
    }
  }
  if (outFormat === output || outFormat === ("." + output)) {
    output = path.parse(input);
    output.ext = outFormat;
    output.base = output.name + output.ext;
    output = path.format(output);
  }
  if (inFormat === outFormat || input === output) {
    return console.warn("Attempt to convert " + input + " to same extension");
  } else {
    console.log(input, '->', output);
    result = converter(fs.readFileSync(input, 'utf-8'));
    if (typeof result !== 'string') {
      result = convert.toJSON(result);
    }
    return fs.writeFileSync(output, result, 'utf-8');
  }
};

file.main = function(args) {
  var arg, filename, filenames, i, j, len, len1, mode, output, results;
  if (args == null) {
    args = process.argv.slice(2);
  }
  filenames = [];
  output = '.fold';
  mode = null;
  for (i = 0, len = args.length; i < len; i++) {
    arg = args[i];
    switch (mode) {
      case 'output':
        output = arg;
        mode = null;
        break;
      default:
        switch (arg) {
          case '-o':
          case '--output':
            mode = 'output';
            break;
          default:
            filenames.push(arg);
        }
    }
  }
  results = [];
  for (j = 0, len1 = filenames.length; j < len1; j++) {
    filename = filenames[j];
    results.push(file.fileToFile(filename, output));
  }
  return results;
};

if (require.main === module) {
  file.main();
}
