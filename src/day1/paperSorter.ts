import fs from 'fs';
import path from 'path';

const parentDir = path.dirname(path.dirname(__dirname));
const filePath: string = path.join(parentDir, 'data', 'papers.json');

interface Paper {
  title: string;
  year: number;
  citations: number;
}

type allPapers = (path: string) => Paper[];

const readData: allPapers = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const jsonData: Paper[] = JSON.parse(data);
    return jsonData;
  } catch (error) {
    console.log(`Error Occured while reading the Data!: ${error}`);
    return [];
  }
};

const ListOfPapers = readData(filePath);
// return top n cited papers
const topCited = (allPapers: Paper[], n: number = 1): Paper[] => {
  return allPapers.sort((a, b) => b.citations - a.citations).slice(0, n);
};

topCited(ListOfPapers, 3).forEach((paper) =>
  console.log(
    `paper name: ${paper.title}, published in: ${paper.year}, # of citations: ${paper.citations}`,
  ),
);
