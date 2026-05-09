import { AppConfigSchema } from '@openclaw/shared';

const config = AppConfigSchema.parse({ name: 'openclaw-web', version: '0.0.1' });

export function App() {
  return (
    <div>
      {config.name} v{config.version}
    </div>
  );
}
