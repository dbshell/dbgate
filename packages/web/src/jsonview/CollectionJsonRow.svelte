<script lang="ts" context="module">
  export function editJsonRowDocument(grider, rowIndex) {
    const rowData = grider.getRowData(rowIndex);
    showModal(EditJsonModal, {
      json: rowData,
      onSave: value => {
        if (value._id != rowData._id) {
          showModal(ErrorMessageModal, { message: '_id attribute cannot be changed' });
          return false;
        }
        grider.setRowData(rowIndex, value);
        return true;
      },
    });
  }
</script>

<script lang="ts">
  import JSONTree from '../jsontree/JSONTree.svelte';
  import EditJsonModal from '../modals/EditJsonModal.svelte';
  import ErrorMessageModal from '../modals/ErrorMessageModal.svelte';
  import { showModal } from '../modals/modalTools';
  import { getContextMenu, registerMenu } from '../utility/contextMenu';

  export let rowIndex;
  export let grider;

  $: rowData = grider.getRowData(rowIndex);
  $: rowStatus = grider.getRowStatus(rowIndex);

  function handleEditDocument() {
    editJsonRowDocument(grider, rowIndex);
  }

  registerMenu([
    { text: 'Edit document', onClick: handleEditDocument },
    { text: 'Delete document', onClick: () => grider.deleteRow(rowIndex) },
    { text: 'Revert row changes', onClick: () => grider.revertRowChanges(rowIndex) },
  ]);
</script>

<JSONTree
  value={rowData}
  labelOverride="({rowIndex + 1}) "
  isModified={rowStatus.status == 'updated'}
  isInserted={rowStatus.status == 'inserted'}
  isDeleted={rowStatus.status == 'deleted'}
/>
