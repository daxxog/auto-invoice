/* auto-invoice
 * Script that makes invoices.
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
    var opt = require('optimist')
                .alias('t', 'template')
                .describe('t', 'png template')
                .default('t', 'invoice-template.png')
                
                .alias('o', 'output')
                .describe('o', 'output mustache fn')
                .default('o', '{{f}}-{{t}}.pdf')
                
                .alias('pc', 'priceCol')
                .describe('pc', 'price column name')
                .default('pc', 'Price')
                
                .alias('p', 'padding')
                .describe('p', 'column padding in spaces')
                .default('p', 7)
                
                .alias('d', 'decimal')
                .describe('d', 'decimal places for cash')
                .default('d', 2)
                
                .usage('auto-invoice [ option(s) ] [ csv filename(s) ]')
                .demand(1),
        argv = opt.argv,
        glob = require('glob'),
        async = require('async'),
        S = require('string'),
        Mustache = require('mustache'),
        PDFDocument = require('pdfkit'),
        Cash = require('cash.js'),
        fs = require('fs'),
        path = require('path');
    
    var fn = argv._,
        template = argv.t,
        output = argv.o,
        priceCol = argv.pc,
        padding = argv.p;
    
    Cash.automin(argv.d);
    
    async.parallel({
        "glob": function(cb) {
            if(typeof fn == 'string') {
                glob(fn, cb);
            } else if(Array.isArray(fn)) {
                cb(null, fn);
            } else {
                glob(fn.toString(), cb);
            }
        },
        "exists": function(cb) {
            fs.exists(template, function(e) {
                cb(null, e);
            });
        },
        "mustache": function(cb) {
            cb(null, Mustache.compile(output));
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
                        var docs = {};
                        async.each(res.glob, function(v, cb) {
                            docs[v] = new PDFDocument();
                            
                            var doc = docs[v],
                                total = Cash.parse('0');
                            
                            doc.image(data, 0, 0, {
                                width: 612,
                                height: 792
                            }).font(path.resolve(__dirname, 'UbuntuMono-R.ttf')).moveDown(7);
                            
                            fs.readFile(v, 'utf8', function(err, data) {
                                var rows = S(data).lines(),
                                    colSize = {},
                                    _priceCol = -1;
                                
                                async.auto({
                                    "findMax": function(cb) {
                                        var row = -1;
                                        
                                        async.eachSeries(rows, function(v, cb) {
                                            row++;
                                            
                                            var col = -1,
                                                cols = v.split(',');
                                            
                                            async.eachSeries(cols, function(v, cb) {
                                                col++;
                                                var len = v.length;
                                                
                                                if(len > 0) {
                                                    if(row === 0 && v === priceCol) {
                                                        _priceCol = col;
                                                    }
                                                    
                                                    if(row > 0 && col === _priceCol) {
                                                        total = total.add(Cash.parse(v));
                                                    }
                                                    
                                                    if(typeof colSize[col] != 'number') {
                                                        colSize[col] = 0;
                                                    }
                                                    
                                                    if(len > colSize[col]) {
                                                        colSize[col] = len;
                                                    }
                                                }
                                                
                                                cb();
                                            }, cb);
                                        }, cb);
                                    },
                                    "doPDF": ["findMax", function(cb) {
                                        var row = -1;
                                        async.eachSeries(rows, function(v, cb) {
                                            row++;
                                            
                                            var col = -1,
                                                cols = v.split(','),
                                                txt = '';
                                            
                                            async.eachSeries(cols, function(v, cb) {
                                                col++;
                                                
                                                if(v.length > 0) {
                                                    txt += S(v).padRight(colSize[col] + padding);
                                                }
                                                
                                                cb();
                                            }, function(err) {
                                                if(txt.length > 1) {
                                                    doc.text(txt);
                                                }
                                                
                                                cb(err);
                                            });
                                        }, cb);
                                    }],
                                    "writeTotal": ["doPDF", function(cb) {
                                        doc.moveDown(2).fontSize(25).text('Total: $' + total.toNumber(), {
                                            align: 'right'
                                        });
                                        cb();
                                    }]
                                }, cb);
                            });
                        }, function(err) {
                            for(var _key in docs) {
                                var key = _key,
                                    doc = docs[key],
                                    dash = S(key).dasherize().s;
                                
                                setTimeout(function() {
                                    doc.write(res.mustache({
                                        f: path.basename(dash, path.extname(dash)),
                                        t: +new Date()
                                    }));
                                }, 0);
                            }
                        });
                    }
                });
            }
        }
    });
}));
