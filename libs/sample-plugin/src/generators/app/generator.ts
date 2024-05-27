import {
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  Tree,
  updateJson,
} from '@nx/devkit';
// import { wrapAngularDevkitSchematic } from '@nx/devkit/ngcli-adapter';
import { applicationGenerator, E2eTestRunner } from '@nx/angular/generators';

import * as path from 'path';

import { AppGeneratorSchema } from './schema';

interface NormalizedSchema extends AppGeneratorSchema {
  project_name: string;
  project_root: string;
  project_directory: string;
}

function normalizeOptions(
  tree: Tree,
  options: AppGeneratorSchema,
): NormalizedSchema {
  const file_name = names(options.name).fileName;
  const name = file_name;
  const project_directory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const project_name = project_directory.replace(new RegExp('/', 'g'), '-');

  const apps_dir = getWorkspaceLayout(tree).appsDir;
  const project_root = `${apps_dir}/${project_directory}`;

  options.title = options.title ?? options.name;
  options.description = options.description ?? '';
  options.keywords = options.keywords ?? '';
  options.copyright = options.copyright ?? options.name;

  return {
    ...options,
    project_name,
    project_root,
    project_directory,
  };
}

function addFiles(tree: Tree, options: NormalizedSchema): void {
  console.log('Adding default template files');

  const template_options = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.project_root),
  };

  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    options.project_root,
    template_options,
  );
}

function cleanUp(tree: Tree, options: NormalizedSchema): void {
  tree.delete(
    joinPathFragments(options.project_root, 'src/app/nx-welcome.component.ts'),
  );
}

function configUpdate(tree: Tree, options: NormalizedSchema): void {
  console.log('Updating Configurations');

  updateJson(
    tree,
    joinPathFragments(options.project_root, 'project.json'),
    (value) => {
      const build = value.targets.build;

      build.options.assets.push({
        glob: '**/*',
        input: joinPathFragments(options.project_root, 'src/.well-known'),
        output: '.well-known/',
      });

      build.configurations.production.budgets = [
        {
          type: 'initial',
          maximumWarning: '2mb',
          maximumError: '5mb',
        },
        {
          type: 'anyComponentStyle',
          maximumWarning: '2kb',
          maximumError: '10kb',
        },
      ];

      const file_replacements = [
        {
          replace: joinPathFragments(
            options.project_root,
            'src/environments/environment.ts',
          ),
          with: joinPathFragments(
            options.project_root,
            'src/environments/environment.prod.ts',
          ),
        },
      ];

      build.configurations.production.fileReplacements = file_replacements;

      return value;
    },
  );
}

export default async function (tree: Tree, schema: AppGeneratorSchema) {
  const options = normalizeOptions(tree, schema);

  console.dir(options);

  console.log('Creating template application');

  await applicationGenerator(tree, {
    name: options.project_name,
    directory: options.project_root,
    style: 'scss',
    skipFormat: true,
    tags: 'type:app',
    e2eTestRunner: E2eTestRunner.None,
    skipTests: true,
    standalone: false,
    projectNameAndRootFormat: 'as-provided',
  });

  // const pwaSchematic = wrapAngularDevkitSchematic('@angular/pwa', 'pwa');

  // console.log('Adding PWA schematics');

  // await pwaSchematic(tree, {
  //   project: options.project_name,
  // });

  configUpdate(tree, options);
  addFiles(tree, options);

  cleanUp(tree, options);

  await formatFiles(tree);
}
