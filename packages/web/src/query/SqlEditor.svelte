<script lang="ts" context="module">
  const engineToMode = {
    mssql: 'sqlserver',
    mysql: 'mysql',
    postgres: 'pgsql',
  };
</script>

<script lang="ts">
  import AceEditor from './AceEditor.svelte';
  import * as ace from 'ace-builds/src-noconflict/ace';
  import useEffect from '../utility/useEffect';
  import { getContext } from 'svelte';
  import { mountCodeCompletion } from './codeCompletion';
  export let engine;
  export let conid;
  export let database;
  export let readOnly;

  let domEditor;

  let mode;

  const tabVisible: any = getContext('tabVisible');

  $: {
    const match = (engine || '').match(/^([^@]*)@/);
    mode = engineToMode[match ? match[1] : engine] || 'sql';
  }

  export function getEditor(): ace.Editor {
    return domEditor.getEditor();
  }

  $: effect = useEffect(() => {
    const editor = domEditor?.getEditor();
    if ($tabVisible && conid && database && !readOnly && editor) {
      return mountCodeCompletion({ conid, database, editor });
    }
    return () => {};
  });
  $: $effect;
</script>

<AceEditor
  {mode}
  {...$$props}
  on:input
  on:focus
  on:blur
  bind:this={domEditor}
  options={{
    enableBasicAutocompletion: true,
  }}
/>
