import {useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

import {DatasetConfig} from '../datasetConfig/base';
import {DEFAULT_TABLE_LIMIT, DisplayType, Widget} from '../types';

export type ChildrenProps = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  totalCount?: string;
};

export type GenericWidgetQueriesProps<SeriesResponse, TableResponse> = {
  api: Client;
  children: (props: ChildrenProps) => JSX.Element;
  config: DatasetConfig<SeriesResponse, TableResponse>;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  onDataFetched?: (props: any) => void;
  processRawResult?: (result: any) => void;
  processRawTableResult?: (result: any) => void;
};

function getReferrer(displayType: DisplayType) {
  let referrer: string = '';

  if (displayType === DisplayType.TABLE) {
    referrer = 'api.dashboards.tablewidget';
  } else if (displayType === DisplayType.BIG_NUMBER) {
    referrer = 'api.dashboards.bignumberwidget';
  } else if (displayType === DisplayType.WORLD_MAP) {
    referrer = 'api.dashboards.worldmapwidget';
  } else {
    referrer = `api.dashboards.widget.${displayType}-chart`;
  }

  return referrer;
}

function GenericWidgetQueries<SeriesResponse, TableResponse>({
  config,
  api,
  children,
  cursor,
  limit,
  onDataFetched,
  organization,
  processRawResult,
  processRawTableResult,
  selection,
  widget,
}: GenericWidgetQueriesProps<SeriesResponse, TableResponse>) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<ChildrenProps['errorMessage']>(undefined);
  const [pageLinks, setPageLinks] = useState<ChildrenProps['pageLinks']>(undefined);
  const [tableResults, setTableResults] =
    useState<ChildrenProps['tableResults']>(undefined);
  const [timeseriesResults, setTimeseriesResults] =
    useState<ChildrenProps['timeseriesResults']>(undefined);

  useEffect(() => {
    async function fetchTableData() {
      const responses = await Promise.all(
        widget.queries.map(query => {
          let requestLimit: number | undefined = limit ?? DEFAULT_TABLE_LIMIT;
          let requestCreator = config.getTableRequest;
          if (widget.displayType === DisplayType.WORLD_MAP) {
            requestLimit = undefined;
            requestCreator = config.getWorldMapRequest;
          }
          return requestCreator!(
            api,
            query,
            organization,
            selection,
            requestLimit,
            cursor,
            getReferrer(widget.displayType)
          );
        })
      );

      // transform the data
      let transformedTableResults: TableDataWithTitle[] = [];
      let responsePageLinks: string | null = null;
      responses.forEach(([data, _textstatus, resp], i) => {
        processRawTableResult?.(data);
        // Cast so we can add the title.
        const transformedData = config.transformTable(
          data,
          widget.queries[0],
          organization,
          selection
        ) as TableDataWithTitle;
        transformedData.title = widget.queries[i]?.name ?? '';

        // Overwrite the local var to work around state being stale in tests.
        transformedTableResults = [...transformedTableResults, transformedData];
        responsePageLinks = resp?.getResponseHeader('Link');
      });

      if (!isMounted) {
        return;
      }

      onDataFetched?.({
        tableResults: transformedTableResults,
        pageLinks: responsePageLinks ?? undefined,
      });
      setTableResults(transformedTableResults);
      setPageLinks(responsePageLinks);
    }

    async function fetchSeriesData() {
      const responses = await Promise.all(
        widget.queries.map((_query, index) => {
          return config.getSeriesRequest!(
            api,
            widget,
            index,
            organization,
            selection,
            getReferrer(widget.displayType)
          );
        })
      );
      const transformedTimeseriesResults: Series[] = [];
      responses.forEach((rawResults, requestIndex) => {
        processRawResult?.(rawResults);
        const transformedResult = config.transformSeries!(
          rawResults,
          widget.queries[requestIndex],
          organization
        );
        // When charting timeseriesData on echarts, color association to a timeseries result
        // is order sensitive, ie series at index i on the timeseries array will use color at
        // index i on the color array. This means that on multi series results, we need to make
        // sure that the order of series in our results do not change between fetches to avoid
        // coloring inconsistencies between renders.
        transformedResult.forEach((result, resultIndex) => {
          transformedTimeseriesResults[
            requestIndex * transformedResult.length + resultIndex
          ] = result;
        });
      });

      if (!isMounted) {
        return;
      }

      onDataFetched?.({timeseriesResults: transformedTimeseriesResults});
      setTimeseriesResults(transformedTimeseriesResults);
    }

    async function fetchData() {
      setLoading(true);
      setTableResults(undefined);
      setTimeseriesResults(undefined);

      try {
        if (
          [DisplayType.TABLE, DisplayType.BIG_NUMBER, DisplayType.WORLD_MAP].includes(
            widget.displayType
          )
        ) {
          await fetchTableData();
        } else {
          await fetchSeriesData();
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err?.responseJSON?.detail || t('An unknown error occurred.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    let isMounted = true;
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [
    api,
    config,
    cursor,
    limit,
    onDataFetched,
    organization,
    processRawResult,
    processRawTableResult,
    selection,
    widget,
    widget.displayType,
  ]);

  return children({loading, tableResults, timeseriesResults, errorMessage, pageLinks});
}

export default GenericWidgetQueries;