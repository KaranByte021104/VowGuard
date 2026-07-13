import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
  
  @Get('site-catalog')
  getSiteCatalog() {
    return [
      // Cloud Providers
      { id: '1',  name: 'Amazon Web Services', domain: 'aws.amazon.com',       templateType: 'WEBSITE',  category: 'Cloud' },
      { id: '2',  name: 'Google Cloud',         domain: 'console.cloud.google.com', templateType: 'WEBSITE', category: 'Cloud' },
      { id: '3',  name: 'Microsoft Azure',      domain: 'portal.azure.com',    templateType: 'WEBSITE',  category: 'Cloud' },
      { id: '4',  name: 'DigitalOcean',         domain: 'cloud.digitalocean.com', templateType: 'WEBSITE', category: 'Cloud' },
      { id: '5',  name: 'Cloudflare',           domain: 'cloudflare.com',      templateType: 'WEBSITE',  category: 'Cloud' },
      // Developer Tools
      { id: '6',  name: 'GitHub',               domain: 'github.com',          templateType: 'WEBSITE',  category: 'DevTools' },
      { id: '7',  name: 'GitLab',               domain: 'gitlab.com',          templateType: 'WEBSITE',  category: 'DevTools' },
      { id: '8',  name: 'Bitbucket',            domain: 'bitbucket.org',       templateType: 'WEBSITE',  category: 'DevTools' },
      { id: '9',  name: 'Vercel',               domain: 'vercel.com',          templateType: 'WEBSITE',  category: 'DevTools' },
      { id: '10', name: 'Netlify',              domain: 'netlify.com',          templateType: 'WEBSITE',  category: 'DevTools' },
      { id: '11', name: 'Docker Hub',           domain: 'hub.docker.com',      templateType: 'WEBSITE',  category: 'DevTools' },
      { id: '12', name: 'NPM',                  domain: 'npmjs.com',           templateType: 'WEBSITE',  category: 'DevTools' },
      // Productivity & Communication
      { id: '13', name: 'Google',               domain: 'google.com',          templateType: 'WEBSITE',  category: 'Productivity' },
      { id: '14', name: 'Slack',                domain: 'slack.com',           templateType: 'WEBSITE',  category: 'Communication' },
      { id: '15', name: 'Microsoft 365',        domain: 'office.com',          templateType: 'WEBSITE',  category: 'Productivity' },
      { id: '16', name: 'Notion',               domain: 'notion.so',           templateType: 'WEBSITE',  category: 'Productivity' },
      { id: '17', name: 'Zoom',                 domain: 'zoom.us',             templateType: 'WEBSITE',  category: 'Communication' },
      { id: '18', name: 'Figma',                domain: 'figma.com',           templateType: 'WEBSITE',  category: 'Productivity' },
      // Project Management
      { id: '19', name: 'Jira',                 domain: 'atlassian.com',       templateType: 'WEBSITE',  category: 'ProjectMgmt' },
      { id: '20', name: 'Linear',               domain: 'linear.app',          templateType: 'WEBSITE',  category: 'ProjectMgmt' },
      { id: '21', name: 'Trello',               domain: 'trello.com',          templateType: 'WEBSITE',  category: 'ProjectMgmt' },
      { id: '22', name: 'Asana',                domain: 'asana.com',           templateType: 'WEBSITE',  category: 'ProjectMgmt' },
      // Databases
      { id: '23', name: 'PostgreSQL',           domain: 'postgres',            templateType: 'DATABASE', category: 'Database' },
      { id: '24', name: 'MySQL',                domain: 'mysql',               templateType: 'DATABASE', category: 'Database' },
      { id: '25', name: 'MongoDB',              domain: 'mongodb.com',         templateType: 'DATABASE', category: 'Database' },
      { id: '26', name: 'Redis',                domain: 'redis.io',            templateType: 'DATABASE', category: 'Database' },
      // Security & Identity
      { id: '27', name: 'Okta',                 domain: 'okta.com',            templateType: 'WEBSITE',  category: 'Security' },
      { id: '28', name: 'Auth0',                domain: 'auth0.com',           templateType: 'WEBSITE',  category: 'Security' },
      { id: '29', name: 'Twilio',               domain: 'twilio.com',          templateType: 'WEBSITE',  category: 'Security' },
      // Finance & Payments
      { id: '30', name: 'Stripe',               domain: 'stripe.com',          templateType: 'WEBSITE',  category: 'Finance' },
    ];
  }
}
