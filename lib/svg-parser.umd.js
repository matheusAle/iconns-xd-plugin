(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.svgParser = global.svgParser || {})));
}(this, function (exports) { 'use strict';

	function getLocator ( source ) {
		var originalLines = source.split( '\n' );

		var start = 0;
		var lineRanges = originalLines.map( function ( line, i ) {
			var end = start + line.length + 1;
			var range = { start: start, end: end, line: i };

			start = end;
			return range;
		});

		var i = 0;

		function rangeContains ( range, index ) {
			return range.start <= index && index < range.end;
		}

		function getLocation ( range, index ) {
			return { line: range.line, column: index - range.start, character: index };
		}

		return function locate ( search, startIndex ) {
			if ( typeof search === 'string' ) {
				search = source.indexOf( search, startIndex || 0 );
			}

			var range = lineRanges[i];

			var d = search >= range.end ? 1 : -1;

			while ( range ) {
				if ( rangeContains( range, search ) ) return getLocation( range, search );

				i += d;
				range = lineRanges[i];
			}
		};
	}

	function locate ( source, search, startIndex ) {
		return getLocator( source )( search, startIndex );
	}

	var validNameCharacters = /[a-zA-Z0-9:-]/;
	var whitespace = /[\s\t\r\n]/;
	var quotemark = /['"]/;

	function repeat ( str, i ) {
		var result = '';
		while ( i-- ) result += str;
		return result;
	}

	function parse ( source ) {
		var header = '';
		var stack = [];

		var state = metadata;
		var currentElement = null;
		var root = null;

		function error ( message ) {
			var ref = locate( source, i );
			var line = ref.line;
			var column = ref.column;
			var before = source.slice( 0, i ).replace( /^\t+/, function (match) { return repeat( '  ', match.length ); } );
			var beforeLine = /(^|\n).*$/.exec( before )[0];
			var after = source.slice( i );
			var afterLine = /.*(\n|$)/.exec( after )[0];

			var snippet = "" + beforeLine + afterLine + "\n" + (repeat( ' ', beforeLine.length )) + "^";

			throw new Error( (message + " (" + line + ":" + column + "). If this is valid SVG, it's probably a bug in svg-parser. Please raise an issue at https://gitlab.com/Rich-Harris/svg-parser/issues – thanks!\n\n" + snippet) );
		}

		function metadata () {
			while ( i < source.length && source[i] !== '<' || !validNameCharacters.test( source[ i + 1 ] ) ) {
				header += source[ i++ ];
			}

			return neutral();
		}

		function neutral () {
			var text = '';
			while ( i < source.length && source[i] !== '<' ) text += source[ i++ ];

			if ( /\S/.test( text ) ) {
				currentElement.children.push( text );
			}

			if ( source[i] === '<' ) {
				return tag;
			}

			return neutral;
		}

		function tag () {
			var char = source[i];

			if ( char === '?' ) return neutral; // <?xml...

			if ( char === '!' ) {
				if ( source.slice( i + 1, i + 3 ) === '--' ) return comment;
				if ( source.slice( i + 1, i + 8 ) === '[CDATA[' ) return cdata;
				if ( /doctype/i.test( source.slice( i + 1, i + 8 ) ) ) return neutral;
			}

			if ( char === '/' ) return closingTag;

			var name = getName();

			var element = {
				name: name,
				attributes: {},
				children: []
			};

			if ( currentElement ) {
				currentElement.children.push( element );
			} else {
				root = element;
			}

			var attribute;
			while ( i < source.length && ( attribute = getAttribute() ) ) {
				element.attributes[ attribute.name ] = attribute.value;
			}

			var selfClosing = false;

			if ( source[i] === '/' ) {
				i += 1;
				selfClosing = true;
			}

			if ( source[i] !== '>' ) {
				error( 'Expected >' );
			}

			if ( !selfClosing ) {
				currentElement = element;
				stack.push( element );
			}

			return neutral;
		}

		function comment () {
			var index = source.indexOf( '-->', i );
			if ( !~index ) error( 'expected -->' );

			i = index + 2;
			return neutral;
		}

		function cdata () {
			var index = source.indexOf( ']]>', i );
			if ( !~index ) error( 'expected ]]>' );

			currentElement.children.push( source.slice( i + 7, index ) );

			i = index + 2;
			return neutral;
		}

		function closingTag () {
			var name = getName();

			if ( !name ) error( 'Expected tag name' );

			if ( name !== currentElement.name ) {
				error( ("Expected closing tag </" + name + "> to match opening tag <" + (currentElement.name) + ">") );
			}

			if ( source[i] !== '>' ) {
				error( 'Expected >' );
			}

			stack.pop();
			currentElement = stack[ stack.length - 1 ];

			return neutral;
		}

		function getName () {
			var name = '';
			while ( i < source.length && validNameCharacters.test( source[i] ) ) name += source[ i++ ];

			return name;
		}

		function getAttribute () {
			if ( !whitespace.test( source[i] ) ) return null;
			allowSpaces();

			var name = getName();
			if ( !name ) return null;

			var value = true;

			allowSpaces();
			if ( source[i] === '=' ) {
				i += 1;
				allowSpaces();

				value = getAttributeValue();
				if ( !isNaN( value ) ) value = +value; // TODO whitelist numeric attributes?
			}

			return { name: name, value: value };
		}

		function getAttributeValue () {
			return quotemark.test( source[i] ) ?
				getQuotedAttributeValue() :
				getUnquotedAttributeValue();
		}

		function getUnquotedAttributeValue () {
			var value = '';
			do {
				var char = source[i];
				if ( char === ' ' || char === '>' || char === '/' ) {
					return value;
				}

				value += char;
				i += 1;
			} while ( i < source.length );

			return value;
		}

		function getQuotedAttributeValue () {
			var quotemark = source[ i++ ];

			var value = '';
			var escaped = false;

			while ( i < source.length ) {
				var char = source[ i++ ];
				if ( char === quotemark && !escaped ) {
					return value;
				}

				if ( char === '\\' && !escaped ) {
					escaped = true;
				}

				value += escaped ? ("\\" + char) : char;
				escaped = false;
			}
		}

		function allowSpaces () {
			while ( i < source.length && whitespace.test( source[i] ) ) i += 1;
		}

		var i = metadata.length;
		while ( i < source.length ) {
			if ( !state ) error( 'Unexpected character' );
			state = state();
			i += 1;
		}

		if ( state !== neutral ) {
			error( 'Unexpected end of input' );
		}

		if ( root.name === 'svg' ) root.metadata = header;
		return root;
	}

	exports.parse = parse;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=svg-parser.umd.js.map
