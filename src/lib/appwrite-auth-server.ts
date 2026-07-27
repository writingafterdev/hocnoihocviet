import { Account, Client, type Models } from 'appwrite';

export class AssessmentAuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AssessmentAuthenticationError';
  }
}

export async function requireAssessmentUser(request: Request): Promise<Models.User<Models.Preferences>> {
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) throw new AssessmentAuthenticationError();

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  if (!endpoint || !projectId) {
    throw new Error('Appwrite server authentication is not configured.');
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setJWT(match[1]);

  try {
    return await new Account(client).get();
  } catch {
    throw new AssessmentAuthenticationError('Invalid or expired session.');
  }
}
