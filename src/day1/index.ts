interface userNames {
  firstName: string;
  lastName: string;
  fullName: () => string;
}

const userNameInfo: userNames[] = [
  {
    firstName: 'firstName1',
    lastName: 'lastName1',
    fullName: function () {
      return `${this.firstName} ${this.lastName}`;
    },
  },
  {
    firstName: 'firstName2',
    lastName: 'lastName2',
    fullName: function () {
      return `${this.firstName} ${this.lastName}`;
    },
  },
];

userNameInfo.push({
  firstName: 'firstName3',
  lastName: 'lastName3',
  fullName: function () {
    return `${this.firstName} ${this.lastName}`;
  },
});

type userInfo = userNames;

function sendGreetingsToUser(info: userInfo): string {
  if (typeof info.firstName == 'string') {
    return `Hello ${info.fullName()},  \n wish you the best experience ever with us!`;
  }
  return `Hello ${info.firstName}, \n wish you the best experience ever with us!`;
}

userNameInfo.forEach((data) => console.log(sendGreetingsToUser(data)));
