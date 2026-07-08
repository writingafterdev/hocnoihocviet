import { DEMO_PROMPT } from './writing-demo';

export interface Prompt {
  id: string;
  task: 'task1' | 'task2';
  title: string;
  category: string;
  topic: string;
  text: string;
  image: string;
}

export const promptsDatabase: Prompt[] = [
  {
    id: 'p1-tech-communication',
    task: 'task2',
    title: 'Technology and Communication',
    category: 'Discussion',
    topic: 'Science and Technology',
    text: DEMO_PROMPT,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p2-university-admission',
    task: 'task2',
    title: 'University Admission Criteria',
    category: 'Discussion',
    topic: 'Education',
    text: 'Many people believe that universities should only offer places to students with the highest marks. Others say they should accept people of all ages, even if they did not do well at school. Discuss both views and give your own opinion.',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p3-crime-media',
    task: 'task2',
    title: 'Crime and Violent Media',
    category: 'Agree or Disagree',
    text: 'In many countries, an increase in crime has been blamed on violent images on television and in computer games. To what extent do you agree or disagree?',
    topic: 'Government & Criminal Justice',
    image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p4-environment-responsibility',
    task: 'task2',
    title: 'Environmental Responsibility',
    category: 'Discussion',
    topic: 'Environment',
    text: 'Some people think that environmental problems are too big for individuals to solve, while others think that individuals cannot solve these environmental problems unless governments make some action. Discuss both views and give your opinion.',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p5-childhood-development',
    task: 'task2',
    title: 'Childhood Development',
    category: 'Discussion',
    topic: 'Society and Culture',
    text: 'Some people think that parents should teach children how to be good members of society. Others, however, believe that school is the best place to learn this. Discuss both these views and give your own opinion.',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca6b3f04846?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p6-public-transport',
    task: 'task2',
    title: 'Free Public Transport',
    category: 'Advantages and Disadvantages',
    topic: 'Travel and Transportation',
    text: 'Some people think that public transportation should be free for everyone. What are the advantages and disadvantages of this?',
    image: 'https://images.unsplash.com/photo-1494961104209-3c223057bd26?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p7-remote-work',
    task: 'task2',
    title: 'Rise of Remote Work',
    category: 'Positive or Negative Development',
    topic: 'Work and Careers',
    text: 'In recent years, many people have started working from home instead of going to an office. Is this a positive or negative development?',
    image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p8-obesity-fast-food',
    task: 'task2',
    title: 'Fast Food and Obesity',
    category: 'Causes, Problems and Solutions',
    topic: 'Health',
    text: 'In many countries, the proportion of older people is steadily increasing. Does this trend have more positive or negative effects on society?',
    image: 'https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&w=800&q=80'
  },
];

export function getPromptById(id: string): Prompt | undefined {
  return promptsDatabase.find(p => p.id === id);
}
