import { Modal } from "@shopify/polaris";

interface ModalCustomProps {
  modalActive: boolean;
  handleCancle: () => void;
  numberOfProduct: number;
  handleDelete: () => void;
}

export default function ModalCustom({
  modalActive,
  handleCancle,
  numberOfProduct,
  handleDelete,
}: ModalCustomProps) {
  return (
    <Modal
      open={modalActive}
      onClose={handleCancle}
      title={`Are you sure you want to delete ${numberOfProduct} products?`}
      primaryAction={{
        content: "Delete",
        destructive: true,
        onAction: handleDelete,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: handleCancle,
        },
      ]}
    >
      <Modal.Section>
        <p>This action cannot be undone.</p>
      </Modal.Section>
    </Modal>
  );
}
