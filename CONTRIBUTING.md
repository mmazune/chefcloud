# Contributing to ChefCloud

Thank you for your interest in contributing to ChefCloud! We welcome contributions from the community.

## Development Workflow

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chefcloud.git
   cd chefcloud
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

4. **Make your changes**
   - Follow TypeScript strict mode
   - Write meaningful commit messages (Conventional Commits)
   - Add tests for new features
   - Update documentation as needed

5. **Run quality checks**
   ```bash
   pnpm run lint
   pnpm run test
   pnpm run format:check
   ```

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

7. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

8. **Open a Pull Request**

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Code style/formatting
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding/updating tests
- `build:` Build system changes
- `ci:` CI configuration
- `chore:` Other changes

## Code Style

- TypeScript strict mode enabled
- ESLint + Prettier configured
- Use meaningful variable names
- Write self-documenting code
- Add comments for complex logic

## Pull Request Process

1. Ensure CI passes (lint, test, build)
2. Update README.md if needed
3. Request review from maintainers
4. Address review feedback
5. Squash commits if requested
6. Merge once approved

## Issue Labels

- `feat` - New feature requests
- `bug` - Bug reports
- `chore` - Maintenance tasks
- `docs` - Documentation improvements
- `good-first-issue` - Good for newcomers
- `help-wanted` - Community help needed
- `blocked` - Blocked by dependencies

## Questions?

Open a discussion or reach out to maintainers.

Thank you for contributing! 🙏
