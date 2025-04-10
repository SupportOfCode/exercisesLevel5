import { Modal, TitleBar } from "@shopify/app-bridge-react";

interface argOfModal {
  text: {
    titleModal: string;
    titleMain: string;
    titleAction: string;
  };
  handleCancle: () => void;
  handleMain: () => void;
}

export function ModalCustom({ text, handleCancle, handleMain }: argOfModal) {
  return (
    <Modal id="modal-custom">
      <p style={{ margin: "12px" }}>{text.titleMain}</p>
      <TitleBar title={text.titleModal}>
        <button onClick={handleMain} tone={"default"} variant="primary">
          {text.titleAction}
        </button>
        <button onClick={handleCancle}>Cancel</button>
      </TitleBar>
    </Modal>
  );
}
