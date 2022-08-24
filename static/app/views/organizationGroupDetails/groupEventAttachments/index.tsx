import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import type {Group, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import GroupEventAttachments from './groupEventAttachments';

type Props = RouteComponentProps<{groupId: string; orgId: string}, {}> & {
  group: Group;
  organization: Organization;
};

const GroupEventAttachmentsContainer = ({organization, group}: Props) => (
  <Feature
    features={['event-attachments']}
    organization={organization}
    renderDisabled={props => (
      <FeatureDisabled {...props} featureName={t('Event Attachments')} />
    )}
  >
    <GroupEventAttachments projectSlug={group.project.slug} />
  </Feature>
);

export default withOrganization(GroupEventAttachmentsContainer);
