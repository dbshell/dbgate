<script lang="ts">
  import moment from 'moment';
  import { writable } from 'svelte/store';
  import HorizontalSplitter from '../elements/HorizontalSplitter.svelte';
  import LargeButton from '../elements/LargeButton.svelte';
  import VerticalSplitter from '../elements/VerticalSplitter.svelte';

  import FormProvider from '../forms/FormProvider.svelte';
  import FormTextField from '../forms/FormTextField.svelte';
  import LargeFormButton from '../forms/LargeFormButton.svelte';
  import FontIcon from '../icons/FontIcon.svelte';
  import createImpExpScript from '../impexp/createImpExpScript';
  import ImportExportConfigurator from '../impexp/ImportExportConfigurator.svelte';
  import PreviewDataGrid from '../impexp/PreviewDataGrid.svelte';
  import { getDefaultFileFormat } from '../plugins/fileformats';
  import RunnerOutputFiles from '../query/RunnerOutputFiles.svelte';
  import SocketMessageView from '../query/SocketMessageView.svelte';
  import { currentArchive, extensions, selectedWidget } from '../stores';
  import axiosInstance from '../utility/axiosInstance';
  import createRef from '../utility/createRef';
  import openNewTab from '../utility/openNewTab';
  import socket from '../utility/socket';
  import useEffect from '../utility/useEffect';
  import WidgetColumnBar from '../widgets/WidgetColumnBar.svelte';
  import WidgetColumnBarItem from '../widgets/WidgetColumnBarItem.svelte';
  import ModalBase from './ModalBase.svelte';
  import { closeCurrentModal } from './modalTools';

  let busy = false;
  let executeNumber = 0;
  let runnerId = null;

  const previewReaderStore = writable(null);

  export let initialValues;
  export let uploadedFile = undefined;
  export let openedFile = undefined;
  export let importToArchive = false;

  const refreshArchiveFolderRef = createRef(null);

  $: targetArchiveFolder = importToArchive ? `import-${moment().format('YYYY-MM-DD-hh-mm-ss')}` : $currentArchive;

  $: effect = useEffect(() => registerRunnerDone(runnerId));

  function registerRunnerDone(rid) {
    if (rid) {
      socket.on(`runner-done-${rid}`, handleRunnerDone);
      return () => {
        socket.off(`runner-done-${rid}`, handleRunnerDone);
      };
    } else {
      return () => {};
    }
  }

  $: $effect;

  const handleRunnerDone = () => {
    busy = false;
    if (refreshArchiveFolderRef.get()) {
      axiosInstance.post('archive/refresh-folders', {});
      axiosInstance.post('archive/refresh-files', { folder: refreshArchiveFolderRef.get() });
      $currentArchive = refreshArchiveFolderRef.get();
      $selectedWidget = 'archive';
    }
  };

  const handleGenerateScript = async e => {
    closeCurrentModal();
    const code = await createImpExpScript($extensions, e.detail);
    openNewTab(
      {
        title: 'Shell #',
        icon: 'img shell',
        tabComponent: 'ShellTab',
      },
      { editor: code }
    );
  };

  const handleExecute = async e => {
    if (busy) return;
    const values = e.detail;
    busy = true;
    const script = await createImpExpScript($extensions, values);
    executeNumber += 1;
    let runid = runnerId;
    const resp = await axiosInstance.post('runners/start', { script });
    runid = resp.data.runid;
    runnerId = runid;

    if (values.targetStorageType == 'archive') {
      refreshArchiveFolderRef.set(values.targetArchiveFolder);
    } else {
      refreshArchiveFolderRef.set(null);
    }
  };

  const handleCancel = () => {
    axiosInstance.post('runners/cancel', {
      runid: runnerId,
    });
  };
</script>

<FormProvider
  initialValues={{
    sourceStorageType: 'database',
    targetStorageType: importToArchive ? 'archive' : getDefaultFileFormat($extensions).storageType,
    sourceArchiveFolder: $currentArchive,
    targetArchiveFolder,
    ...initialValues,
  }}
>
  <ModalBase {...$$restProps} fullScreen>
    <svelte:fragment slot="header">
      Import/Export
      {#if busy}
        <FontIcon icon="icon loading" />
      {/if}
    </svelte:fragment>

    <HorizontalSplitter initialValue="70%">
      <div class="content" slot="1">
        <ImportExportConfigurator {uploadedFile} {openedFile} {previewReaderStore} />
      </div>

      <svelte:fragment slot="2">
        <WidgetColumnBar>
          <WidgetColumnBarItem title="Output files" name="output" height="20%">
            <RunnerOutputFiles {runnerId} {executeNumber} />
          </WidgetColumnBarItem>
          <WidgetColumnBarItem title="Messages" name="messages">
            <SocketMessageView eventName={runnerId ? `runner-info-${runnerId}` : null} {executeNumber} />
          </WidgetColumnBarItem>
          <WidgetColumnBarItem title="Preview" name="preview" skip={!$previewReaderStore}>
            <PreviewDataGrid reader={$previewReaderStore} />
          </WidgetColumnBarItem>
          <WidgetColumnBarItem title="Advanced configuration" name="config" collapsed>
            <FormTextField label="Schedule" name="schedule" />
            <FormTextField label="Start variable index" name="startVariableIndex" />
          </WidgetColumnBarItem>
        </WidgetColumnBar>
      </svelte:fragment>
    </HorizontalSplitter>

    <svelte:fragment slot="footer">
      <div class="flex m-2">
        {#if busy}
          <LargeButton icon="icon close" on:click={handleCancel}>Cancel</LargeButton>
        {:else}
          <LargeFormButton on:click={handleExecute} icon="icon run">Run</LargeFormButton>
        {/if}
        <LargeFormButton icon="img sql-file" on:click={handleGenerateScript}>Generate script</LargeFormButton>

        <LargeButton on:click={closeCurrentModal} icon="icon close">Close</LargeButton>
      </div>
    </svelte:fragment>
  </ModalBase>
</FormProvider>

<style>
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
