/* name
 * description
 * (c) 2013 David (daXXog) Volm ><> + + + <><
 * Released under Apache License, Version 2.0:
 * http://www.apache.org/licenses/LICENSE-2.0.html  
 */

/* UMD LOADER: https://github.com/umdjs/umd/blob/master/returnExports.js */
(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else {
        // Browser globals (root is window)
        root.returnExports = factory();
    }
}(this, function() {
    var argv = require('optimist')
               .alias('t', 'template')
               .alias('o', 'output')
               .argv,
        glob = require('glob'),
        async = require('async'),
        fs = require('fs');
    
    var fn = argv._[0],
        template = (typeof argv.t == 'undefined') ? 'invoice-template.png' : argv.t,
        output = (typeof argv.o == 'undefined') ? 'invoice-{{f}}-{{d}}.pdf' : argv.o;
    
    async.parallel({
        "glob": function(cb) {
            glob(fn, cb);
        },
        "exists": function(cb) {
            fs.exists(template, function(e) {
                cb(null, e);
            });
        }
    }, function(err, res) {
        if(err) {
            console.error(err);
        } else {
            if(!res.exists) {
                console.log('Could not find invoice template: ' + template);
            } else if(res.glob.length === 0) {
                console.log('File not found: ' + fn);
            } else {
                fs.readFile(template, function(err, data) {
                    if(err) {
                        console.error(err);
                    } else {
                        async.each(res.glob, function(v, cb) {
                            console.log(v + output);
                        }, function(err) {
                            console.log(res);
                        });
                    }
                });
            }
        }
    });
}));