"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricResolvers = exports.partitionBy = exports.partitionByTypes = void 0;
const cross_table_1 = require("../cross-table");
const filters_1 = require("../filters");
const types_1 = require("../types");
const wrapper_1 = require("./wrapper");
exports.partitionByTypes = {
    by: types_1.PropTypes.string,
};
function partitionBy(args, query, knex) {
    let partition;
    if (!!args.by) {
        let partitionBy = (0, filters_1.buildFullName)(args, query, args.by, false);
        if (query.replaceWith?.[args.by]) {
            partitionBy = query.replaceWith[args.by].value;
        }
        partition = knex.raw(`PARTITION BY ??`, [partitionBy]);
    }
    return partition || '';
}
exports.partitionBy = partitionBy;
exports.metricResolvers = {
    percentile: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        return query.promise.select(knex.raw(`PERCENTILE_CONT(??) WITHIN GROUP(ORDER BY ??) AS ??`, [
            parseFloat(args.factor) || 0.5,
            (0, filters_1.buildFullName)(args, query, args.a, false),
            alias,
        ]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        factor: types_1.PropTypes.number,
        from: types_1.PropTypes.string,
    }, ['PERCENTILE_CONT', 'WITHIN GROUP']),
    median: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        return query.promise.select(knex.raw(`MEDIAN(??) OVER (${partitionBy(args, query, knex)}) AS ??`, [
            args.a,
            alias,
        ]));
    }, {
        from: types_1.PropTypes.string,
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string,
    }, ['MEDIAN', 'PARTITION BY', 'ORDER BY']),
    sum: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        return query.promise.sum(`${(0, filters_1.buildFullName)(args, query, args.a, false)} as ${alias}`);
    }, {
        a: types_1.PropTypes.string,
        from: types_1.PropTypes.string,
    }, ['SUM']),
    min: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        return query.promise.min(`${(0, filters_1.buildFullName)(args, query, args.a, false)} as ${alias}`);
    }, {
        a: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['MIN']),
    max: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        return query.promise.max(`${(0, filters_1.buildFullName)(args, query, args.a, false)} as ${alias}`);
    }, {
        a: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['MAX']),
    count: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        return query.promise.count(args.a
            ? `${(0, filters_1.buildFullName)(args, query, args.a, false)} as ${alias}`
            : '1');
    }, {
        a: types_1.PropTypes.string,
        from: types_1.PropTypes.string,
    }, ['COUNT']),
    countDistinct: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        return query.promise.countDistinct(`${(0, filters_1.buildFullName)(args, query, args.a, false)} as ${alias}`);
    }, {
        a: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['COUNT', 'DISTINCT']),
    join: (0, cross_table_1.join)(cross_table_1.JoinType.DEFAULT),
    leftJoin: (0, cross_table_1.join)(cross_table_1.JoinType.LEFT),
    rightJoin: (0, cross_table_1.join)(cross_table_1.JoinType.RIGHT),
    fullJoin: (0, cross_table_1.join)(cross_table_1.JoinType.FULL),
    innerJoin: (0, cross_table_1.join)(cross_table_1.JoinType.INNER),
    leftOuterJoin: (0, cross_table_1.join)(cross_table_1.JoinType.LEFT_OUTER),
    rightOuterJoin: (0, cross_table_1.join)(cross_table_1.JoinType.RIGHT_OUTER),
    fullOuterJoin: (0, cross_table_1.join)(cross_table_1.JoinType.FULL_OUTER),
    ranking: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        let alg = 'DENSE_RANK';
        if (args.alg === 'denseRank') {
            alg = 'DENSE_RANK';
        }
        else if (args.alg === 'rank') {
            alg = 'RANK';
        }
        else if (args.alg === 'rowNumber') {
            alg = 'ROW_NUMBER';
        }
        const promise = (0, filters_1.applyFilters)(query, (0, filters_1.withFilters)(query.filters)(knex
            .select('*')
            .select(knex.raw(`${alg}() over (${partitionBy(args, query, knex)} ORDER BY ?? desc) as ??`, [(0, filters_1.buildFullName)(args, query, args.a, false), alias]))
            .from(query.table || args.from), knex), knex);
        const table = args.tableAlias || args.from || query.table;
        const finalPromise = query.promise
            .select((0, filters_1.buildFullName)({ from: table }, query, alias, false))
            .from(promise.as(args.tableAlias || query.table));
        (0, cross_table_1.changeQueryTable)(query, knex, table, true);
        finalPromise.groupBy((0, filters_1.buildFullName)({ from: table }, query, alias, false));
        return finalPromise;
    }, {
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string,
        alg: types_1.PropTypes.oneOf(['denseRank', 'rank', 'rowNumber']),
        from: types_1.PropTypes.string,
        tableAlias: types_1.PropTypes.string,
    }, ['DENSE_RANK', 'RANK', 'ROW_NUMBER', 'OVER', 'PARTITION BY']),
    searchRanking: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        const key = (0, filters_1.buildFullName)({ from: args.from || query.table }, query, args.a, false);
        if (!query.search[key])
            throw `SearchRanking requires search query for ${key} field`;
        return query.promise.select(knex.raw("ts_rank(to_tsvector('simple', ??), (plainto_tsquery('simple', ?)::text || ':*')::tsquery) as ??", [key, query.search[key], alias]));
    }, { a: types_1.PropTypes.string.isRequired, from: types_1.PropTypes.string }, ['PLAINTO_TSQUERY', 'TO_TSVECTOR', 'TS_RANK']),
    searchHeadline: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        const key = (0, filters_1.buildFullName)({ from: args.from || query.table }, query, args.a, false);
        if (!query.search[key])
            throw `SearchHeadline requires search query for ${key} field`;
        return query.promise.select(knex.raw("ts_headline('simple', ??, (plainto_tsquery('simple', ?)::text || ':*')::tsquery) as ??", [key, query.search[key], alias]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['PLAINTO_TSQUERY', 'TS_HEADLINE']),
    unique: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        const field = (0, filters_1.buildFullName)(args, query, args?.a || alias, false);
        return query.promise.select(`${field} as ${alias}`).groupBy(field);
    }, {
        a: types_1.PropTypes.string,
        from: types_1.PropTypes.string,
    }, ['GROUP BY']),
    from: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        const field = (0, filters_1.buildFullName)(args, query, args?.a || alias, false);
        return query.promise.select(`${field} as ${alias}`);
    }, {
        a: types_1.PropTypes.string,
        from: types_1.PropTypes.string.isRequired,
    }, []),
    avg: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        return query.promise.select(knex.raw(`avg(??) over (${partitionBy(args, query, knex)})::float4 as ??`, [(0, filters_1.buildFullName)(args, query, args.a, false), alias]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string,
        from: types_1.PropTypes.string,
    }, ['AVG', 'PARTITION BY']),
    avgPerDimension: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        return query.promise.select(knex.raw(`sum(??)::float/COUNT(DISTINCT ??)::float4 as ??`, [
            (0, filters_1.buildFullName)(args, query, args.a, false),
            (0, filters_1.buildFullName)(args, query, args.per, false),
            alias,
        ]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        per: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['SUM', 'COUNT', 'DISTINCT']),
    share: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        return query.promise.select(knex.raw(`sum(??)/NULLIF(sum(sum(??)) over (${partitionBy(args, query, knex)}), 0)::float4 as ??`, [
            (0, filters_1.buildFullName)(args, query, args.a, false),
            (0, filters_1.buildFullName)(args, query, args.a, false),
            alias,
        ]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string,
        from: types_1.PropTypes.string,
    }, ['SUM', 'NULLIF', 'OVER', 'PARTITION BY']),
    indexed: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        return query.promise.select(knex.raw(`sum(??)/NULLIF(max(sum(??)::float) over (${partitionBy(args, query, knex)}), 0)::float4 as ??`, [
            (0, filters_1.buildFullName)(args, query, args.a, false),
            (0, filters_1.buildFullName)(args, query, args.a, false),
            alias,
        ]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string,
        from: types_1.PropTypes.string,
    }, ['MAX', 'SUM', 'NULLIF', 'OVER', 'PARTITION BY']),
    divide: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        const functions = Object.keys(args).reduce((r, k) => {
            const fns = args[k].split('|');
            if (fns.length === 2) {
                args[k] = fns[1];
                r[k] = fns[0];
            }
            return r;
        }, { a: 'sum', by: 'sum' });
        return query.promise.select(knex.raw(`cast(??(??) as float)/NULLIF(cast(??(??) as float), 0)::float4 as ??`, [
            functions.a,
            (0, filters_1.buildFullName)(args, query, args.a, false),
            functions.by,
            (0, filters_1.buildFullName)(args, query, args.by, false),
            alias,
        ]));
    }, {
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['CAST', 'NULLIF']),
    aggrAverage: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        let internal = query.promise
            .select((0, filters_1.buildFullName)(args, query, alias, false))
            .sum(`${(0, filters_1.buildFullName)(args, query, args.to, false)} as ${args.to}`)
            .sum(`${(0, filters_1.buildFullName)(args, query, args.by, false)} as ${args.by}`)
            .select(knex.raw(`?? * sum(??) as "aggrAverage"`, [
            (0, filters_1.buildFullName)(args, query, alias, false),
            (0, filters_1.buildFullName)(args, query, args.to, false),
        ]))
            .groupBy((0, filters_1.buildFullName)(args, query, alias, false));
        if (args.to !== args.by)
            internal = internal.sum(`${(0, filters_1.buildFullName)(args, query, args.by, false)} as ${args.by}`);
        let promise = knex
            .select(query.dimensions)
            .select(knex.raw(`sum("aggrAverage")/max(??)::float4  as "${alias}_aggrAverage"`, [(0, filters_1.buildFullName)(args, query, args.by, false)]))
            .from(internal.as('middleTable'));
        if (!!query.dimensions && query.dimensions.length > 0) {
            promise = promise.groupBy(query.dimensions);
        }
        return promise;
    }, {
        to: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['SUM', 'MAX', 'GROUP BY']),
    weightAvg: (0, wrapper_1.metricWrapper)((alias, args, query, knex) => {
        let internal = query.promise
            .select((0, filters_1.buildFullName)(args, query, args.a, false))
            .sum(`${(0, filters_1.buildFullName)(args, query, args.by, false)} as ${args.by}`)
            .select(knex.raw(`?? * sum(??)::float4 as "weightAvg"`, [
            (0, filters_1.buildFullName)(args, query, args.a, false),
            (0, filters_1.buildFullName)(args, query, args.by, false),
        ]))
            .groupBy((0, filters_1.buildFullName)(args, query, args.a, false));
        let promise = knex
            .select(query.dimensions)
            .select(knex.raw(`sum("weightAvg")/sum(??)::float4 as "${alias}"`, [
            (0, filters_1.buildFullName)(args, query, args.by, false),
        ]))
            .from(internal.as('middleTable'));
        if (!!query.dimensions && query.dimensions.length > 0) {
            promise = promise.groupBy(query.dimensions);
        }
    }, {
        a: types_1.PropTypes.string.isRequired,
        by: types_1.PropTypes.string.isRequired,
        from: types_1.PropTypes.string,
    }, ['SUM', 'GROUP BY']),
    distinct: (0, wrapper_1.metricWrapper)((alias, args, query) => {
        return query.promise.distinct((0, filters_1.buildFullName)(args, query, alias, false));
    }, {
        from: types_1.PropTypes.string,
    }, ['DISTINCT']),
    default: (0, wrapper_1.metricWrapper)((alias, args, query, _, { tree }) => {
        // Getters are needed only for additionaly selected fields by some specific functions
        // example: price(groupByEach: 50) -> price: 0-50 -> groupByEach_min_price: 0 -> groupByEach_max_price: 50
        // would be useful for further grouping && filtering
        const isInGetters = query.getters?.find((name) => name === tree.name.value);
        if (!isInGetters) {
            if (!alias) {
                return query.promise.select(`${(0, filters_1.buildFullName)(args, query, tree.name.value)}`);
            }
            else {
                return query.promise.select(`${(0, filters_1.buildFullName)(args, query, tree.name.value)} as ${alias}`);
            }
        }
        return query.promise;
    }),
};
