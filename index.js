var util = require('util');
var url = require('url');
var pegjs = require('pegjs');

var rhizome = module.exports = function rhizome(config) {
  var parse = config.parse || rhizome.parse;
  var dispatch = config.dispatch || rhizome.dispatch;
  var makeinput = config.makeinput || rhizome.makeinput;
  function getResource(base, selector) {
    var input = url.resolve(base, selector);
    var tree = parse(config, input);
    if (!tree) {
      return null;
    }
    var result = rhizome.resolve(tree);
    if (!result.node) {
      return null;
    }
    var path = result.suffix ?
          input.slice(0, -result.suffix.length) :
          input;
    var type = result.node.type;
    var Constructor = config.resources[type];
    if (!(Constructor && Constructor instanceof Function)) {
      throw new TypeError('Unknown resource type ' +
                util.inspect(type));
    }
    function select(relpath) {
      var result = getResource(path + '/', relpath);
      return result ? result.resource : null;
    }
    result.resource = new Constructor(result.node, path, select);
    return result;
  }
  return function (req, res, next) {
    var result = getResource('', makeinput(req), req);
    if (result && result.resource) {
      dispatch(config, result, req, res, next);
    } else {
      next();
    }
  };
};

rhizome.pegjs = pegjs;

//
// rhizome.makeinput
//
// The user may replace this implementation by providing config.makeinput,
// for example to construct input based on req.hostname and req.url.
//
rhizome.makeinput = function makeinput(req) {
  return req.url;
};

//
// rhizome.parse
//
// Parse a url and return a parse tree.
//
// This default implementation is suitable for pegjs parsers.
// If a parser syntax error occurs, it returns null to indicate
// that the url did not match the grammar.
//
rhizome.parse = function parse(config, input) {
  var parser = config.parser;
  var tree;
  try {
    tree = parser.parse(input, config.startRule);
  }
  catch (e) {
    // pegjs provides parser.SyntaxError, but we try
    // to be compatible with other parsers that might not.
    if (parser.SyntaxError && (e instanceof parser.SyntaxError)) {
      if (config.debug) {
        var marker = '';
        if (e.column) {
          for (var i = e.column; i > 1; i--) {
            marker += ' ';
          }
          marker += '^ ';
        }
        console.log(input + '\n' + marker);
        console.log(e);
      }
      return null;
    }
    throw e;
  }
  return tree;
};

//
// rhizome.dispatch
//
// Dispatch a request against the resolved resource object.
//
// It looks for a method on the resource object having the same name as the
// http verb of the request, i.e. resource.get, resource.post etc, or
// resource.all as a fallback. If that method exists it is called, e.g:
//
//  resource.get(req, res, next, suffix);
//
// Arguments:
//
//  config      The config object that was passed to rhizome.
//
//  result      The result of resolving against the parse tree.
//              result.resource is the resource object.
//              result.suffix is the url portion following the resource's path.
//
//  req,res,next The request and response objects and the next function passed
//              to this middleware for this request. Each call to dispatch
//              should normally result eventually in a call to res.end (via
//              res.send, res.render etc) or next(err).
//
//
rhizome.dispatch = function (config, result, req, res, next) {
  var resource = result.resource;
  var suffix = result.suffix;
  if (!resource) {
    // No error but resolved to a null resource - fall through silently.
    if (config.debug) {
      console.log(req.url + ' resolved to null resource');
    }
    return next();
  }
  if ('object' !== typeof resource) {
    return next(new TypeError('resource is not an object'));
  }
  var fn = resource[req.method.toLowerCase()] || resource.all;
  if ('function' === typeof fn) {
    fn.call(resource, req, res, next, suffix);
  } else {
    res.send('Resource at ' + req.url +
        ' does not implement ' + req.method + '\r\n', 404);
  }
};

//
// rhizome.resolve
//
// Resolve from resourceRoot to a resource selected by the parse tree.
//
// The parser returns a parse tree representing the url. This is
// a tree of nested arrays.
//
// Returns:
//
//  {
//    node: // the last object in the tree, or null if none.
//    suffix: // string component of the url following node
//  }
//
rhizome.resolve = function resolve(tree) {
  if (Array.isArray(tree)) {
    var node;
    var suffix = '';
    for (var i = tree.length - 1; !node && i >= 0; i--) {
      var branch = resolve(tree[i]);
      node = branch.node;
      suffix = branch.suffix + suffix;
    }
    return {
      node: node,
      suffix: suffix
    };
  } else if ('string' === typeof tree) {
    return {
      suffix: tree
    };
  } else {
    return {
      node: tree,
      suffix: ''
    };
  }
};
