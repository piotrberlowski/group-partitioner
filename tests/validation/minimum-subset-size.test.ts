import { solveMIP } from '../../src/algorithms/mip-solver';
import { retainLegalSubsets } from '../../src/subsetSize';
import type { Competitor } from '../../src/types';

function archer(id: string): Competitor {
    return { id, equipmentClass: 'HB', ageCategory: 'A', gender: 'M' };
}

describe('minimum subset size', () => {
    it('repairs a remainder of 2 by borrowing from a full group', () => {
        const groups = [
            [archer('1'), archer('2'), archer('3'), archer('4')],
            [archer('5'), archer('6')],
        ];

        const legal = retainLegalSubsets(groups, 3, 4);

        expect(legal.map((group) => group.length).sort()).toEqual([3, 3]);
    });

    it('does not leave a single archer on a target when the other group is already full', () => {
        const groups = [
            [archer('1'), archer('2'), archer('3'), archer('4')],
            [archer('5')],
        ];

        const legal = retainLegalSubsets(groups, 1, 4);

        expect(legal).toHaveLength(1);
        expect(legal[0]).toHaveLength(4);
        expect(legal.flat().map((archer) => archer.id)).not.toContain('5');
    });

    it('does not emit a target of size 2 from the solver', () => {
        const competitors = [archer('1'), archer('2'), archer('3'), archer('4'), archer('5'), archer('6')];
        const result = solveMIP(competitors, {
            minSubsetSize: 2,
            maxSubsetSize: 4,
            preferredSubsetSize: 4,
        });

        expect(result.result.subsets.every((subset) => subset.length >= 3)).toBe(true);
        expect(result.result.metadata.totalCompetitors).toBe(6);
    });
});
