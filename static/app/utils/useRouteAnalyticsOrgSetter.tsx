import {useContext, useEffect} from 'react';

import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

// This is the hook that is used to pass route analytics functions to routes.
export default function useRouteAnalyticsOrgSetter() {
  const organization = useContext(OrganizationContext);
  const {setOrganization} = useContext(RouteAnalyticsContext);
  useEffect(() => {
    organization && setOrganization(organization);
  }, [organization, setOrganization]);
}