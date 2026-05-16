import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

export const main = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken;

  if (!token) {
    throw new Error('Unauthorized');
  }

  const encodedCreds = token.split(' ')[1];
  const [username, password] = Buffer.from(encodedCreds, 'base64').toString('utf-8').split(':');

  const storedPassword = process.env[username];
  const effect = storedPassword && storedPassword === password ? 'Allow' : 'Deny';

  return {
    principalId: username,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: event.methodArn,
        },
      ],
    },
  };
};
