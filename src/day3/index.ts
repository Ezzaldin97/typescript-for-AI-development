import { z } from 'zod';

const userProfileSchema = z.object({
  userID: z.number().gt(0),
  name: z.string().min(3),
  posts: z.number(),
});

type userProfile = z.infer<typeof userProfileSchema>;

const userProfiles: userProfile[] = [];

function addUserProfile(profile: userProfile): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const currentProfile = userProfileSchema.parse(profile);
        userProfiles.push(currentProfile);
        resolve(
          `Profile created successfully: ${currentProfile.userID} is name: ${currentProfile.name}, # posts: ${currentProfile.posts}`,
        );
      } catch (error) {
        reject(`Validation Error: ${error}`);
      }
    }, 2000);
  });
}

function fetchUserProfile(userID: number): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const data = userProfiles.find((user) => user.userID === userID);
        if (data) {
          resolve(`user: ${data.name} and has ${data.posts} posts`);
        } else {
          reject(`user ${userID} doesn't exist`);
        }
      } catch (error) {
        reject(`Error occurred while fetching user: ${error}`);
      }
    }, 2000);
  });
}

// Best implementation - Clean and robust
const addOrFetchUser = async (data: userProfile): Promise<string> => {
  try {
    // Try to fetch the user
    return await fetchUserProfile(data.userID);
  } catch {
    // User not found, create them
    console.log(`User ${data.userID} not found. Creating...`);
    await addUserProfile(data);
    // Fetch the newly created user
    return await fetchUserProfile(data.userID);
  }
};

// Test the implementation
async function test() {
  const newUser1: userProfile = {
    userID: 1,
    name: 'Alice',
    posts: 5,
  };

  const newUser2: userProfile = {
    userID: 2,
    name: 'brian',
    posts: 2,
  };

  const newUser3: userProfile = {
    userID: 3,
    name: 'lisa',
    posts: 7,
  };

  // First call - should create user
  console.log('First call:');
  const [result1, result2, result3] = await Promise.allSettled([
    addOrFetchUser(newUser1),
    addOrFetchUser(newUser2),
    addOrFetchUser(newUser3),
  ]);
  console.log('Result:', result1);
  console.log('Result:', result2);
  console.log('Result:', result3);

  // Second call - should fetch existing user
  console.log('\nSecond call:');
  const [result4, result5, result6] = await Promise.allSettled([
    addOrFetchUser(newUser1),
    addOrFetchUser(newUser2),
    addOrFetchUser(newUser3),
  ]);
  console.log('Result:', result4);
  console.log('Result:', result5);
  console.log('Result:', result6);
}

test();
