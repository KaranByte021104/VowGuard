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
      { id: '1', name: 'Google', domain: 'google.com', templateType: 'WEBSITE' },
      { id: '2', name: 'AWS', domain: 'aws.amazon.com', templateType: 'WEBSITE' },
      { id: '3', name: 'GitHub', domain: 'github.com', templateType: 'WEBSITE' },
      { id: '4', name: 'Slack', domain: 'slack.com', templateType: 'WEBSITE' },
      { id: '5', name: 'Jira', domain: 'atlassian.com', templateType: 'WEBSITE' },
      { id: '6', name: 'PostgreSQL', domain: 'postgres', templateType: 'DATABASE' },
    ];
  }
}
