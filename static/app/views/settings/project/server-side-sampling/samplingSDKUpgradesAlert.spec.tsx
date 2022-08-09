import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {SamplingSDKUpgradesAlert} from 'sentry/views/settings/project/server-side-sampling/samplingSDKUpgradesAlert';

import {
  getMockData,
  mockedProjects,
  recommendedSdkUpgrades,
  uniformRule,
} from './testUtils/utils';

describe('Server-Side Sampling - Sdk Upgrades Alert', function () {
  it('does not render content', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKUpgradesAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        rules={[uniformRule]}
        recommendedSdkUpgrades={[]}
        incompatibleProjects={[]}
        showLinkToTheModal
      />
    );

    expect(
      screen.queryByTestId('recommended-sdk-upgrades-alert')
    ).not.toBeInTheDocument();
  });

  it('renders content with update sdks info', function () {
    const {organization, project} = getMockData();

    render(
      <Fragment>
        <GlobalModal />
        <SamplingSDKUpgradesAlert
          organization={organization}
          projectId={project.id}
          onReadDocs={jest.fn()}
          rules={[uniformRule]}
          recommendedSdkUpgrades={recommendedSdkUpgrades}
          showLinkToTheModal
          incompatibleProjects={[]}
        />
      </Fragment>
    );

    expect(screen.getByTestId('recommended-sdk-upgrades-alert')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Learn More'})).toBeInTheDocument();

    expect(
      screen.getByText(
        'To activate server-side sampling rules, it’s a requirement to update the following project SDK(s):'
      )
    ).toBeInTheDocument();

    expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: mockedProjects[1].slug})).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${mockedProjects[1].id}`
    );

    // Click on learn more button
    userEvent.click(screen.getByRole('button', {name: 'Learn More'}));

    // Recommended steps modal is rendered
    expect(
      screen.getByRole('heading', {
        name: 'Update the following SDK versions',
      })
    ).toBeInTheDocument();
  });

  it('renders incompatible sdks', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKUpgradesAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        rules={[uniformRule]}
        recommendedSdkUpgrades={recommendedSdkUpgrades}
        showLinkToTheModal
        incompatibleProjects={[TestStubs.Project({slug: 'angular', platform: 'angular'})]}
      />
    );

    expect(screen.getByTestId('recommended-sdk-upgrades-alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The following projects are currently incompatible with Server-Side Sampling:'
      )
    ).toBeInTheDocument();

    expect(screen.getByTestId('platform-icon-angular')).toBeInTheDocument();
  });
});
