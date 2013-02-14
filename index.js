var util = require('util');
var pegjs = require('pegjs');

var rhizome = module.exports = function rhizome(config) {
  var parse = config.parse || rhizome.parse;
  var dispatch = config.dispatch || rhizome.dispatch;
  var makeinput = config.makeinput || rhizome.makeinput;

  return function (req, res, next) {
    var input = makeinput(req);
    var node = parse(config, input);
    config.factory(req, node, function (err, resource) {
      if (err) {
        return next(err);
      }
      dispatch(config, resource, req, res, next);
    });
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
// Dispatch a request against a resource object.
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
//  resource    The resource constructed by the factory.
//
//  req,res,next The request and response objects and the next function passed
//              to this middleware for this request. Each call to dispatch
//              should normally result eventually in a call to res.end (via
//              res.send, res.render etc) or next(err).
//
//
rhizome.dispatch = function (config, resource, req, res, next) {
  if (!resource) {
    // No error but null resource - fall through silently.
    return next();
  }
  if ('object' !== typeof resource) {
    return next(new TypeError('resource is not an object'));
  }
  var method = req.method.toLowerCase();
  var fn = resource[method] || resource.all;
  if (!fn && method === 'head') {
    fn = resource['get'];
  }
  if ('function' === typeof fn) {
    fn.call(resource, req, res, next);
  } else {
    res.send(404, 'Resource at ' + req.url +
        ' does not implement ' + req.method + '\r\n');
  }
};
