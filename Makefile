.PHONY: install build schema test test-ts test-py golden examples gallery serve-gallery studio clean

install:
	npm install
	pip install -e ./sdks/python-sdk -e ./mcp-server/python

build:
	npm run build

schema:
	npm run export:schema

test-ts:
	npm test

test-py:
	pytest sdks/python-sdk mcp-server/python

golden:
	npm run golden

test: test-ts test-py

examples:
	npm run render:examples

gallery:
	npm run gallery

serve-gallery:
	python3 -m http.server 4173 --directory examples/rendered --bind 0.0.0.0

studio:
	npm run studio

clean:
	rm -rf core-engine/dist mcp-server/typescript/dist mcp-server/rest-facade/dist sdks/node-sdk/dist connectors/setup/dist
