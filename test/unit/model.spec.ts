import { containsUpdate } from '@oasislabs/parcel/model';

describe('containsUpdate', () => {
    it('false', () => {
        expect(containsUpdate(undefined)).toBe(false);
        expect(containsUpdate([])).toBe(false);
        expect(containsUpdate({ params: {}, array: [] })).toBe(false);
    });

    it('true', () => {
        expect(containsUpdate(false)).toBe(true);
        expect(containsUpdate(null)).toBe(true);
        expect(containsUpdate(0)).toBe(true);
        expect(containsUpdate('')).toBe(true);
        expect(containsUpdate([null])).toBe(true);
        expect(containsUpdate({ params: {}, array: [], num: 0 })).toBe(true);
    });
});
