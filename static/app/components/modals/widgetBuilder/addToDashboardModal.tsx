import {Fragment, useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import {
  fetchDashboard,
  fetchDashboards,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/selectControl';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DateString, Organization, PageFilters, SelectValue} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import {
  DashboardDetails,
  DashboardListItem,
  DisplayType,
  MAX_WIDGETS,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import {
  getDashboardFiltersFromURL,
  getSavedFiltersAsPageFilters,
  getSavedPageFilters,
} from 'sentry/views/dashboardsV2/utils';
import {NEW_DASHBOARD_ID} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

type WidgetAsQueryParams = Query & {
  defaultTableColumns: string[];
  defaultTitle: string;
  defaultWidgetQuery: string;
  displayType: DisplayType;
  environment: string[];
  project: number[];
  source: string;
  end?: DateString;
  start?: DateString;
  statsPeriod?: string | null;
};

export type AddToDashboardModalProps = {
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widget: Widget;
  widgetAsQueryParams: WidgetAsQueryParams;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

function AddToDashboardModal({
  Header,
  Body,
  Footer,
  closeModal,
  location,
  organization,
  router,
  selection,
  widget,
  widgetAsQueryParams,
}: Props) {
  const api = useApi();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardDetails | null>(
    null
  );
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    fetchDashboards(api, organization.slug).then(response => {
      // If component has unmounted, dont set state
      if (unmounted) {
        return;
      }

      setDashboards(response);
    });

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug]);

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    if (selectedDashboardId === NEW_DASHBOARD_ID || selectedDashboardId === null) {
      setSelectedDashboard(null);
    } else {
      fetchDashboard(api, organization.slug, selectedDashboardId).then(response => {
        // If component has unmounted, dont set state
        if (unmounted) {
          return;
        }

        setSelectedDashboard(response);
      });
    }

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug, selectedDashboardId]);

  function handleGoToBuilder() {
    const pathname =
      selectedDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${organization.slug}/dashboards/new/widget/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/widget/new/`;

    router.push({
      pathname,
      query: {
        ...widgetAsQueryParams,
        ...(organization.features.includes('dashboards-top-level-filter') &&
        selectedDashboard
          ? getSavedPageFilters(selectedDashboard)
          : {}),
      },
    });
    closeModal();
  }

  async function handleAddAndStayInDiscover() {
    if (selectedDashboard === null) {
      return;
    }

    let orderby = widget.queries[0].orderby;
    if (!!!(DisplayType.AREA && widget.queries[0].columns.length)) {
      orderby = ''; // Clear orderby if its not a top n visualization.
    }
    const query = widget.queries[0];

    const newWidget = {
      ...widget,
      title: widget.title === '' ? t('All Events') : widget.title,
      queries: [{...query, orderby}],
    };

    try {
      const newDashboard = {
        ...selectedDashboard,
        widgets: [...selectedDashboard.widgets, newWidget],
      };

      await updateDashboard(api, organization.slug, newDashboard);

      closeModal();
      addSuccessMessage(t('Successfully added widget to dashboard'));
    } catch (e) {
      const errorMessage = t('Unable to add widget to dashboard');
      handleXhrErrorResponse(errorMessage)(e);
      addErrorMessage(errorMessage);
    }
  }

  const canSubmit = selectedDashboardId !== null;

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>
      <Body>
        <Wrapper>
          <SelectControl
            disabled={dashboards === null}
            menuPlacement="auto"
            name="dashboard"
            placeholder={t('Select Dashboard')}
            value={selectedDashboardId}
            options={
              dashboards && [
                {label: t('+ Create New Dashboard'), value: 'new'},
                ...dashboards.map(({title, id, widgetDisplay}) => ({
                  label: title,
                  value: id,
                  isDisabled: widgetDisplay.length >= MAX_WIDGETS,
                  tooltip:
                    widgetDisplay.length >= MAX_WIDGETS &&
                    tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                      maxWidgets: MAX_WIDGETS,
                    }),
                  tooltipOptions: {position: 'right'},
                })),
              ]
            }
            onChange={(option: SelectValue<string>) => {
              if (option.disabled) {
                return;
              }
              setSelectedDashboardId(option.value);
            }}
          />
        </Wrapper>
        <Wrapper>
          {organization.features.includes('dashboards-top-level-filter')
            ? t(
                'Any conflicting filters from this query will be overridden by Dashboard filters. This is a preview of how the widget will appear in your dashboard.'
              )
            : t('This is a preview of how the widget will appear in your dashboard.')}
        </Wrapper>
        <WidgetCard
          api={api}
          organization={organization}
          currentWidgetDragging={false}
          isEditing={false}
          isSorting={false}
          widgetLimitReached={false}
          selection={
            organization.features.includes('dashboards-top-level-filter') &&
            selectedDashboard
              ? getSavedFiltersAsPageFilters(selectedDashboard)
              : selection
          }
          dashboardFilters={
            organization.features.includes('dashboards-top-level-filter')
              ? getDashboardFiltersFromURL(location) ?? selectedDashboard?.filters
              : {}
          }
          widget={widget}
          showStoredAlert
        />
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          <Button
            onClick={handleAddAndStayInDiscover}
            disabled={!canSubmit || selectedDashboardId === NEW_DASHBOARD_ID}
            title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
          >
            {t('Add + Stay in Discover')}
          </Button>
          <Button
            priority="primary"
            onClick={handleGoToBuilder}
            disabled={!canSubmit}
            title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
          >
            {t('Open in Widget Builder')}
          </Button>
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export default AddToDashboardModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
`;
