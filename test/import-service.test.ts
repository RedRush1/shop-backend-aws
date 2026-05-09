import { main as importProductsFile } from '../lib/import-service/importProductsFile';

// ─── Mock AWS SDK modules ────────────────────────────────────────────────────
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const MOCK_SIGNED_URL = 'https://s3.amazonaws.com/test-bucket/uploaded/products.csv?signed=true';

// ─── Re-import mocked modules to spy on them ────────────────────────────────
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

// ─── Set env variables ───────────────────────────────────────────────────────
beforeAll(() => {
  process.env.BUCKET_NAME = 'test-import-bucket';
  process.env.REGION = 'us-east-1';
  mockedGetSignedUrl.mockResolvedValue(MOCK_SIGNED_URL);
});

afterEach(() => {
  jest.clearAllMocks();
  mockedGetSignedUrl.mockResolvedValue(MOCK_SIGNED_URL);
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('importProductsFile', () => {
  it('should return 400 when "name" query parameter is missing', async () => {
    const event = { queryStringParameters: null };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
    expect(body.message).toContain('name');
  });

  it('should return 400 when queryStringParameters is an empty object', async () => {
    const event = { queryStringParameters: {} };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
  });

  it('should return 200 with a signed URL when "name" is provided', async () => {
    const event = { queryStringParameters: { name: 'products.csv' } };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('url');
    expect(body.url).toBe(MOCK_SIGNED_URL);
  });

  it('should call getSignedUrl with the correct key pattern (uploaded/<fileName>)', async () => {
    const event = { queryStringParameters: { name: 'my-products.csv' } };

    await importProductsFile(event);

    expect(mockedGetSignedUrl).toHaveBeenCalledTimes(1);
    // The second argument to getSignedUrl is a PutObjectCommand; verify its input key
    const commandArg = mockedGetSignedUrl.mock.calls[0][1] as any;
    expect(commandArg.input.Key).toBe('uploaded/my-products.csv');
    expect(commandArg.input.Bucket).toBe('test-import-bucket');
    expect(commandArg.input.ContentType).toBe('text/csv');
  });

  it('should return 200 with correct CORS headers', async () => {
    const event = { queryStringParameters: { name: 'file.csv' } };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Access-Control-Allow-Origin']).toBeDefined();
    expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET');
  });

  it('should return 500 when getSignedUrl throws an error', async () => {
    mockedGetSignedUrl.mockRejectedValueOnce(new Error('S3 error'));

    const event = { queryStringParameters: { name: 'products.csv' } };

    const result = await importProductsFile(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('message');
    expect(body.message).toBe('Internal server error');
  });
});

