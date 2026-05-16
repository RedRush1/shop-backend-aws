import { SQSEvent } from 'aws-lambda';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Each factory is self-contained (no external variable references).
// The private __xxx properties give tests stable handles into the factory-scoped fns.

jest.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
    TransactWriteItemsCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
    __mockSend: mockSend,
  };
});

jest.mock('aws-sdk', () => {
  const mockPublish = jest.fn();
  return {
    SNS: jest.fn().mockImplementation(() => ({ publish: mockPublish })),
    __mockPublish: mockPublish,
  };
});

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

import * as DDB from '@aws-sdk/client-dynamodb';
import * as AWS from 'aws-sdk';
import { main } from '../lib/product-service/catalogBatchProcess';

// ─── Stable references to factory-scoped mock fns ─────────────────────────────
const mockDynamoSend = (DDB as any).__mockSend as jest.Mock;
const mockSnsPublish = (AWS as any).__mockPublish as jest.Mock;
const MockTransactWriteItemsCommand = DDB.TransactWriteItemsCommand as unknown as jest.Mock;

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.PRODUCTS_TABLE = 'test-products';
  process.env.STOCK_TABLE = 'test-stock';
  process.env.CREATE_PRODUCT_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789012:createProductTopic';
  process.env.AWS_REGION = 'us-east-1';
});

beforeEach(() => {
  mockDynamoSend.mockResolvedValue({});
  mockSnsPublish.mockReturnValue({
    promise: jest.fn().mockResolvedValue({ MessageId: 'test-msg-id' }),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeSqsEvent(records: object[]): SQSEvent {
  return {
    Records: records.map((body) => ({
      messageId: 'msg-id',
      receiptHandle: 'receipt',
      body: JSON.stringify(body),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1',
        SenderId: 'test',
        ApproximateFirstReceiveTimestamp: '1',
      },
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:catalogItemsQueue',
      awsRegion: 'us-east-1',
    })),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('catalogBatchProcess', () => {
  describe('DynamoDB writes', () => {
    it('writes a product and stock entry transactionally for each SQS record', async () => {
      await main(makeSqsEvent([{ title: 'Test Product', description: 'A test', price: 10, count: 5 }]));

      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
      expect(MockTransactWriteItemsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              Put: expect.objectContaining({
                TableName: 'test-products',
                Item: expect.objectContaining({
                  id:          { S: 'mock-uuid-1234' },
                  title:       { S: 'Test Product' },
                  description: { S: 'A test' },
                  price:       { N: '10' },
                }),
              }),
            }),
            expect.objectContaining({
              Put: expect.objectContaining({
                TableName: 'test-stock',
                Item: expect.objectContaining({
                  product_id: { S: 'mock-uuid-1234' },
                  count:      { N: '5' },
                }),
              }),
            }),
          ]),
        }),
      );
    });

    it('defaults count to 0 when omitted from the message', async () => {
      await main(makeSqsEvent([{ title: 'No Count', description: '', price: 5 }]));

      expect(MockTransactWriteItemsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              Put: expect.objectContaining({
                TableName: 'test-stock',
                Item: expect.objectContaining({ count: { N: '0' } }),
              }),
            }),
          ]),
        }),
      );
    });

    it('processes every record in a batch', async () => {
      await main(makeSqsEvent([
        { title: 'A', description: '', price: 10, count: 1 },
        { title: 'B', description: '', price: 20, count: 2 },
        { title: 'C', description: '', price: 30, count: 3 },
      ]));

      expect(mockDynamoSend).toHaveBeenCalledTimes(3);
    });

    it('propagates DynamoDB errors', async () => {
      mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB failure'));

      await expect(
        main(makeSqsEvent([{ title: 'Error Product', description: '', price: 5, count: 1 }])),
      ).rejects.toThrow('DynamoDB failure');
    });
  });

  describe('SNS publishing', () => {
    it('publishes to the SNS topic after each product is created', async () => {
      await main(makeSqsEvent([{ title: 'SNS Product', description: 'desc', price: 50, count: 3 }]));

      expect(mockSnsPublish).toHaveBeenCalledTimes(1);
      expect(mockSnsPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          TopicArn: 'arn:aws:sns:us-east-1:123456789012:createProductTopic',
          Subject: 'New product created',
          Message: expect.stringContaining('SNS Product'),
        }),
      );
    });

    it('includes price as a MessageAttribute for filter policy routing', async () => {
      await main(makeSqsEvent([{ title: 'Premium Item', description: '', price: 150, count: 1 }]));

      expect(mockSnsPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          MessageAttributes: {
            price: { DataType: 'Number', StringValue: '150' },
          },
        }),
      );
    });

    it('publishes once per record in a batch', async () => {
      await main(makeSqsEvent([
        { title: 'A', description: '', price: 10, count: 1 },
        { title: 'B', description: '', price: 20, count: 2 },
      ]));

      expect(mockSnsPublish).toHaveBeenCalledTimes(2);
    });
  });
});
