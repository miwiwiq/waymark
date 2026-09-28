import { bootstrapService } from '@app/common';
import { PostsModule } from './posts.module.js';

await bootstrapService(PostsModule, 'posts');
