# Rhizome

A connect/express middleware for dispatching requests to a
hierarchy of resources, using a grammar to describe the
structure of the url hierarchy.

If you're interested in using this, please bug me to finish this doco.

Synopsis:

    var rhizome = require('rhizome');
    var resources = require('./resources');
    var grammar = 'a valid peg.js grammar';

    var parser = rhizome.pegjs.buildParser(grammar);

    app.use(rhizome({
      parser: parser,
      resources: resources
    }));

You construct a pegjs parser from the given grammar.
Then for each request passed to this middleware, the parser
is given req.url as input, and the resulting parse tree is
traversed to resolve the request to a resource. See also the
comments for rhizome.resolve, below.

config fields:

* `parser` A pegjs (or compatible) parser object, having `parser.parse(input, [startRule])`. Required.

* `resources` An object holding resource constructors. Required.

* `makeinput` Function to extract from a request the input to be parsed. Defaults to `rhizome.makeinput`

* `startRule` The name of the start rule in the grammar. Defaults to the first declared rule.

* `parse` Function to parse a request into a parse tree. Defaults to `rhizome.parse`.

* `dispatch` Function to dispatch a request against a resource. Defaults to `rhizome.dispatch`.

* `debug` True to log parse errors. Defaults to false.

