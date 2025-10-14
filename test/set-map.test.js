import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';

import { assert           } from 'https://deno.land/std@0.208.0/assert/assert.ts';
import { assertEquals     } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts';
import { assertFalse      } from 'https://deno.land/std@0.208.0/assert/assert_false.ts';
import { assertInstanceOf } from 'https://deno.land/std@0.208.0/assert/assert_instance_of.ts';

import { SetMap } from '../lib/set-map.js';

describe('SetMap', () => {
    /** @type {SetMap<any, any>} */
    let setMap;

    beforeEach(() => {
        setMap = new SetMap();

        setMap.add('foo', 'foobar');
        setMap.add('foo', 'foobat');
        setMap.add('foo', 'foobaz');
        setMap.delete('foo', 'foobar');
        setMap.add('removed', 'foobar');
        setMap.delete('removed', 'foobar');
    });

    it('should create a new Set for key', () => {
        assertInstanceOf(setMap.get('foo'), Set);
    });

    it('should add item to set', () => {
        assert(setMap.get('foo')?.has('foobat'));
        assert(setMap.get('foo')?.has('foobaz'));
    });

    it('should remove item from set', () => {
        assertFalse(setMap.get('foo')?.has('foobar'));
    });

    it('should remove empty Sets', () => {
        assertEquals(setMap.get('removed'), undefined);
    });

    it('should return false if deleted but key does not exist', () => {
        assertFalse(setMap.delete('x'));
    });

    describe('count', () => {
        it('should return the number of items in a given set', () => {
            assertEquals(setMap.count('foo'), 2);
            assertEquals(setMap.count('removed'), 0);
        });

        it('should return 0 for a non existent set', () => {
            assertEquals(setMap.count('z'), 0);
        });
    });
});
