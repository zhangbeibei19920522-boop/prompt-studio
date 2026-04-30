import { parseKnowledgeScopeMappingContent } from '@/lib/knowledge/mapping-parser'

describe('knowledge mapping parser', () => {
  it('parses structured mapping tables into normalized scope mapping records', () => {
    const result = parseKnowledgeScopeMappingContent([
      'Sheet: TV Model_platform relation',
      'model | platform | product | deviceCategory',
      '85QD7N | Google | CDMTV | appliance',
      '55R6G | Roku | TV | television',
    ].join('\n'))

    expect(result).toEqual(
      expect.objectContaining({
        rowCount: 2,
        keyField: 'productModel',
        scopeFields: ['productModel', 'platform', 'productCategory', 'deviceCategory'],
        records: [
          {
            lookupKey: '85QD7N',
            scope: {
              productModel: ['85QD7N'],
              platform: ['Google TV'],
              productCategory: ['TV'],
              deviceCategory: ['appliance'],
            },
          },
          {
            lookupKey: '55R6G',
            scope: {
              productModel: ['55R6G'],
              platform: ['Roku TV'],
              productCategory: ['TV'],
              deviceCategory: ['TV'],
            },
          },
        ],
      }),
    )
  })

  it('parses key-value mapping rows without requiring a header row', () => {
    const result = parseKnowledgeScopeMappingContent([
      'model - CFU14N6AWE | product - Freezer',
      'model - RR63D6ASE | product - Refrigerator',
    ].join('\n'))

    expect(result).toEqual(
      expect.objectContaining({
        rowCount: 2,
        keyField: 'productModel',
        scopeFields: ['productModel', 'productCategory'],
        records: [
          {
            lookupKey: 'CFU14N6AWE',
            scope: {
              productModel: ['CFU14N6AWE'],
              productCategory: ['Freezer'],
            },
          },
          {
            lookupKey: 'RR63D6ASE',
            scope: {
              productModel: ['RR63D6ASE'],
              productCategory: ['Refrigerator'],
            },
          },
        ],
      }),
    )
  })
})
