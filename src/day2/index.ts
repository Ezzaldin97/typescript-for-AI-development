interface userNames {
  firstName: string;
  lastName: string;
  fullName: () => string;
}

interface userData extends userNames {
  age: number;
}

const usersData: userData[] = [
  {
    firstName: 'firstName1',
    lastName: 'lastName1',
    fullName: function () {
      return `${this.firstName} ${this.lastName}`;
    },
    age: 29,
  },
  {
    firstName: 'firstName2',
    lastName: 'lastName2',
    fullName: function () {
      return `${this.firstName} ${this.lastName}`;
    },
    age: 27,
  },
];

class userUtils implements userData {
  static created: number = 0;
  static getCount(): void {
    console.log(`${this.created} created successfully!!!!`);
  }
  private _userId: number;
  constructor(
    public firstName: string,
    public lastName: string,
    public age: number,
  ) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.age = age;
    this._userId = 123;
  }

  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  yearOfBirth(this: userUtils): number {
    userUtils.created++;
    const today = new Date();
    return today.getFullYear() - this.age;
  }

  get userId(): number {
    return this._userId;
  }

  set userId(value: number) {
    this._userId = value;
  }
}

usersData.forEach((data) =>
  console.log(`user: ${data.fullName()} has ${data.age}`),
);

const firstUser = usersData[0];
const utils = firstUser
  ? new userUtils(firstUser.firstName, firstUser.lastName, firstUser.age)
  : null;

if (utils) {
  console.log(utils.yearOfBirth());
  console.log(utils.userId);
  userUtils.getCount();
}

abstract class Food {
  constructor(public name: string) {}
  abstract getCookingTime(): void;
}

class Pizza extends Food {
  constructor(
    name: string,
    public price: number,
  ) {
    super(name);
    this.price = price;
  }

  getCookingTime(): void {
    console.log('cooking time is 4 mins');
  }
}

const myPizza = new Pizza('chicken supreme', 150);
console.log(myPizza.getCookingTime());

const returnArgs = <T, S>(valOne: T, valTwo: S): string =>
  `value of 1: ${valOne}, value of 2: ${valTwo}`;

console.log(returnArgs<number, string>(200, 'Hi'));
