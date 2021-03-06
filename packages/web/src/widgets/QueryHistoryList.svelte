<script lang="ts">
  import _ from 'lodash';

  import SearchBoxWrapper from '../elements/SearchBoxWrapper.svelte';
  import SearchInput from '../elements/SearchInput.svelte';
  import useFetch from '../utility/useFetch';
  import WidgetsInnerContainer from '../widgets/WidgetsInnerContainer.svelte';
  import FontIcon from '../icons/FontIcon.svelte';
  import { onMount } from 'svelte';
  import socket from '../utility/socket';
  import axiosInstance from '../utility/axiosInstance';
  import openNewTab from '../utility/openNewTab';

  let filter = '';
  let search = '';

  let historyItems = [];

  async function reloadItems() {
    const resp = await axiosInstance.request({
      method: 'get',
      url: 'query-history/read',
      params: {
        filter: search,
        limit: 100,
      },
    });
    historyItems = resp.data;
  }

  $: {
    search;
    reloadItems();
  }

  const setDebouncedFilter = _.debounce(value => (search = value), 500);

  $: setDebouncedFilter(filter);

  onMount(() => {
    socket.on('query-history-changed', reloadItems);
    return () => {
      socket.off('query-history-changed', reloadItems);
    };
  });

</script>

<SearchBoxWrapper>
  <SearchInput placeholder="Search query history" {filter} bind:value={filter} />
</SearchBoxWrapper>
<WidgetsInnerContainer>
  {#each historyItems as item}
    <div
      class="wrapper"
      title={item.sql}
      on:click={() => {
        openNewTab(
          {
            title: 'Query #',
            icon: 'icon sql-file',
            tabComponent: 'QueryTab',
            props: {
              conid: item.conid,
              database: item.database,
            },
          },
          { editor: item.sql }
        );
      }}
    >
      <div class="sql">
        <FontIcon icon="icon sql-file" />
        {item.sql}
      </div>
      <div class="info">
        <FontIcon icon="icon database" />
        {item.database}
      </div>
    </div>
  {/each}
</WidgetsInnerContainer>

<style>
  .wrapper {
    padding: 5px;
  }
  .wrapper:hover {
    background-color: var(--theme-bg-hover);
  }
  .info {
    margin-left: 30px;
    margin-top: 5px;
    color: var(--theme-font-3);
  }
  .sql {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

</style>
