import React from 'react';
import _ from 'lodash';
import DataGrid from './DataGrid';
import styled from 'styled-components';
import { TableGridDisplay, createGridConfig, createGridCache } from '@dbgate/datalib';
import { getFilterValueExpression } from '@dbgate/filterparser';
import { useConnectionInfo, getTableInfo, useDatabaseInfo } from '../utility/metadataLoaders';
import engines from '@dbgate/engines';
import useSocket from '../utility/SocketProvider';
import { VerticalSplitter } from '../widgets/Splitter';
import stableStringify from 'json-stable-stringify';
import ReferenceHeader from './ReferenceHeader';
import SqlDataGridCore from './SqlDataGridCore';

const ReferenceContainer = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const ReferenceGridWrapper = styled.div`
  position: relative;
  flex: 1;
  display: flex;
`;

export default function TableDataGrid({
  conid,
  database,
  schemaName,
  pureName,
  tabVisible,
  toolbarPortalRef,
  changeSetState,
  dispatchChangeSet,
  config = undefined,
  setConfig = undefined,
  cache = undefined,
  setCache = undefined,
  masterLoadedTime = undefined,
}) {
  // const [childConfig, setChildConfig] = React.useState(createGridConfig());
  const [myCache, setMyCache] = React.useState(createGridCache());
  const [childCache, setChildCache] = React.useState(createGridCache());
  const [refReloadToken, setRefReloadToken] = React.useState(0);
  const [myLoadedTime, setMyLoadedTime] = React.useState(0);

  const { childConfig } = config;
  const setChildConfig = (value, reference = undefined) => {
    if (_.isFunction(value)) {
      setConfig((x) => ({
        ...x,
        childConfig: value(x.childConfig),
      }));
    } else {
      setConfig((x) => ({
        ...x,
        childConfig: value,
        reference: reference === undefined ? x.reference : reference,
      }));
    }
  };
  const { reference } = config;

  const connection = useConnectionInfo({ conid });
  const dbinfo = useDatabaseInfo({ conid, database });
  // const [reference, setReference] = React.useState(null);

  function createDisplay() {
    return connection
      ? new TableGridDisplay(
          { schemaName, pureName },
          engines(connection),
          config,
          setConfig,
          cache || myCache,
          setCache || setMyCache,
          dbinfo
        )
      : null;
  }

  const [display, setDisplay] = React.useState(createDisplay());

  React.useEffect(() => {
    setRefReloadToken((v) => v + 1);
    if (!reference && display && display.isGrouped) display.clearGrouping();
  }, [reference]);

  React.useEffect(() => {
    const newDisplay = createDisplay();
    if (display && display.isLoadedCorrectly && !newDisplay.isLoadedCorrectly) return;
    setDisplay(newDisplay);
  }, [connection, config, cache || myCache, conid, database, schemaName, pureName, dbinfo]);

  const handleDatabaseStructureChanged = React.useCallback(() => {
    (setCache || setMyCache)(createGridCache());
  }, []);

  const socket = useSocket();

  React.useEffect(() => {
    if (display && !display.isLoadedCorrectly) {
      if (conid && socket) {
        socket.on(`database-structure-changed-${conid}-${database}`, handleDatabaseStructureChanged);
        return () => {
          socket.off(`database-structure-changed-${conid}-${database}`, handleDatabaseStructureChanged);
        };
      }
    }
  }, [conid, database, display]);

  const handleReferenceSourceChanged = React.useCallback(
    (selectedRows, loadedTime) => {
      setMyLoadedTime(loadedTime);
      if (!reference) return;
      const filters = {
        ...childConfig.filters,
        ..._.fromPairs(
          reference.columns.map((col) => [
            col.refName,
            selectedRows.map((x) => getFilterValueExpression(x[col.baseName], col.dataType)).join(', '),
          ])
        ),
      };
      if (stableStringify(filters) != stableStringify(childConfig.filters)) {
        setChildConfig((cfg) => ({
          ...cfg,
          filters,
        }));
        setChildCache((ca) => ({
          ...ca,
          refreshTime: new Date().getTime(),
        }));
      }
    },
    [childConfig, reference]
  );

  const handleCloseReference = () => {
    setChildConfig(null, null);
  };

  if (!display) return null;

  return (
    <VerticalSplitter>
      <DataGrid
        // key={`${conid}, ${database}, ${schemaName}, ${pureName}`}
        conid={conid}
        database={database}
        display={display}
        tabVisible={tabVisible}
        changeSetState={changeSetState}
        dispatchChangeSet={dispatchChangeSet}
        toolbarPortalRef={toolbarPortalRef}
        showReferences
        onReferenceClick={(reference) => setChildConfig(createGridConfig(), reference)}
        onReferenceSourceChanged={reference ? handleReferenceSourceChanged : null}
        refReloadToken={refReloadToken.toString()}
        masterLoadedTime={masterLoadedTime}
        GridCore={SqlDataGridCore}
      />
      {reference && (
        <ReferenceContainer>
          <ReferenceHeader reference={reference} onClose={handleCloseReference} />
          <ReferenceGridWrapper>
            <TableDataGrid
              key={`${reference.schemaName}.${reference.pureName}`}
              conid={conid}
              database={database}
              pureName={reference.pureName}
              schemaName={reference.schemaName}
              changeSetState={changeSetState}
              dispatchChangeSet={dispatchChangeSet}
              toolbarPortalRef={toolbarPortalRef}
              tabVisible={false}
              config={childConfig}
              setConfig={setChildConfig}
              cache={childCache}
              setCache={setChildCache}
              masterLoadedTime={myLoadedTime}
            />
          </ReferenceGridWrapper>
        </ReferenceContainer>
      )}
    </VerticalSplitter>
  );
}
