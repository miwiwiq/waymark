import { bootstrapService } from '@app/common';
import { FeedModule } from './feed.module.js';

await bootstrapService(FeedModule, 'feed');
