import {
  getCommonHeader,
  getCommonCard,
  getCommonTitle,
  getCommonGrayCard,
  getCommonContainer
} from "egov-ui-framework/ui-config/screens/specs/utils";
import get from "lodash/get";
import set from "lodash/set";
import { handleScreenConfigurationFieldChange as handleField } from "egov-ui-framework/ui-redux/screen-configuration/actions";
import {
  getQueryArg,
  setBusinessServiceDataToLocalStorage,
  getFileUrlFromAPI
} from "egov-ui-framework/ui-utils/commons";
import { prepareFinalObject } from "egov-ui-framework/ui-redux/screen-configuration/actions";
import { getSearchResults } from "../../../../ui-utils/commons";
import {
  createEstimateData,
  setMultiOwnerForSV,
  setValidToFromVisibilityForSV,
  addressDestruct
} from "../utils";

import { footerReview } from "./applyResource/footer";
import {
  getFeesEstimateCard,
  getHeaderSideText,
  getTransformedStatus
} from "../utils";

import { getOrganizationDetails } from "./applyResource/review-organization";
import { getReviewOwner } from "./applyResource/review-owner";
import {
  getPermanentDetails,
  getCommunicactionDetails
} from "./applyResource/review-location";
import { getReviewDocuments } from "./applyResource/review-documents";

const tenantId = getQueryArg(window.location.href, "tenantId");
let applicationNumber = getQueryArg(window.location.href, "applicationNumber");
let headerSideText = { word1: "", word2: "" };

const setDocuments = async (
  payload,
  sourceJsonPath,
  destJsonPath,
  dispatch
) => {
  const uploadedDocData = get(payload, sourceJsonPath);

  const fileStoreIds =
    uploadedDocData &&
    uploadedDocData
      .map(item => {
        return item.fileStoreId;
      })
      .join(",");
  const fileUrlPayload =
    fileStoreIds && (await getFileUrlFromAPI(fileStoreIds));
  const reviewDocData =
    uploadedDocData &&
    uploadedDocData.map((item, index) => {
      return {
        title: `TL_${item.documentType}` || "",
        link:
          (fileUrlPayload &&
            fileUrlPayload[item.fileStoreId] &&
            fileUrlPayload[item.fileStoreId].split(",")[0]) ||
          "",
        linkText: "View",
        name:
          (fileUrlPayload &&
            fileUrlPayload[item.fileStoreId] &&
            decodeURIComponent(
              fileUrlPayload[item.fileStoreId]
                .split(",")[0]
                .split("?")[0]
                .split("/")
                .pop()
                .slice(13)
            )) ||
          `Document - ${index + 1}`
      };
    });
  reviewDocData && dispatch(prepareFinalObject(destJsonPath, reviewDocData));
};

const getTradeTypeSubtypeDetails = payload => {
  const tradeUnitsFromApi = get(
    payload,
    "Licenses[0].tradeLicenseDetail.tradeUnits",
    []
  );
  const tradeUnitDetails = [];
  tradeUnitsFromApi.forEach(tradeUnit => {
    const { tradeType } = tradeUnit;
    const tradeDetails = tradeType.split(".");
    tradeUnitDetails.push({
      trade: get(tradeDetails, "[0]", ""),
      tradeType: get(tradeDetails, "[1]", ""),
      tradeSubType: get(tradeDetails, "[2]", "")
    });
  });
  return tradeUnitDetails;
};

const searchResults = async (action, state, dispatch, applicationNo) => {
  let queryObject = [
    { key: "tenantId", value: tenantId },
    { key: "applicationNumber", value: applicationNo }
  ];
  let payload = await getSearchResults(queryObject);

  headerSideText = getHeaderSideText(
    get(payload, "Licenses[0].status"),
    get(payload, "Licenses[0].licenseNumber")
  );
  set(payload, "Licenses[0].headerSideText", headerSideText);

  get(payload, "Licenses[0].tradeLicenseDetail.subOwnerShipCategory") &&
  get(payload, "Licenses[0].tradeLicenseDetail.subOwnerShipCategory").split(
    "."
  )[0] === "INDIVIDUAL"
    ? setMultiOwnerForSV(action, true)
    : setMultiOwnerForSV(action, false);

  if (get(payload, "Licenses[0].licenseType")) {
    setValidToFromVisibilityForSV(
      action,
      get(payload, "Licenses[0].licenseType")
    );
  }

  const moduleName = get(
    payload,
    "Licenses[0].tradeLicenseDetail.tradeUnits[0].tradeType"
  ).split(".")[0];

  set(
    action,
    "screenConfig.components.div.children.taskStatus.props.moduleName",
    moduleName
  );

  await setDocuments(
    payload,
    "Licenses[0].tradeLicenseDetail.applicationDocuments",
    "LicensesTemp[0].reviewDocData",
    dispatch
  );
  let sts = getTransformedStatus(get(payload, "Licenses[0].status"));
  payload && dispatch(prepareFinalObject("Licenses[0]", payload.Licenses[0]));
  payload &&
    dispatch(
      prepareFinalObject(
        "LicensesTemp[0].tradeDetailsResponse",
        getTradeTypeSubtypeDetails(payload)
      )
    );
  const LicenseData = payload.Licenses[0];
  const fetchFromReceipt = sts !== "pending_payment";
  createEstimateData(
    LicenseData,
    "LicensesTemp[0].estimateCardData",
    dispatch,
    {}
  );
  //Fetch Bill and populate estimate card
  // const code = get(
  //   payload,
  //   "Licenses[0].tradeLicenseDetail.address.locality.code"
  // );
  // const queryObj = [{ key: "tenantId", value: tenantId }];
  // // getBoundaryData(action, state, dispatch, queryObj, code);
};

const beforeInitFn = async (action, state, dispatch, applicationNumber) => {
  //Search details for given application Number
  if (applicationNumber) {
    !getQueryArg(window.location.href, "edited") &&
      (await searchResults(action, state, dispatch, applicationNumber));

    // const status = getTransformedStatus(
    //   get(state, "screenConfiguration.preparedFinalObject.Licenses[0].status")
    // );

    const subOwnerShipCategory = get(
      state.screenConfiguration.preparedFinalObject,
      "Licenses[0].tradeLicenseDetail.subOwnerShipCategory"
    );
    if (subOwnerShipCategory == "INDIVIDUAL") {
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOrganizationDetails.visible",
        false
      );
    } else {
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOrganizationDetails.visible",
        true
      );
    }

    const tradeType = get(
      state.screenConfiguration.preparedFinalObject,
      "Licenses[0].tradeLicenseDetail.tradeUnits[0].tradeType"
    );
    if (tradeType.split(".").length > 1) {
      if (tradeType.split(".")[0] == "ARCHITECT")
        set(
          action,
          "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOwnerDetails.children.cardContent.children.multiOwner.children.viewFive.children.reviewcounsilForArchNo.visible",
          true
        );
      else
        set(
          action,
          "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOwnerDetails.children.cardContent.children.multiOwner.children.viewFive.children.reviewcounsilForArchNo.visible",
          false
        );
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOwnerDetails.children.cardContent.children.multiOwner.children.viewFive.children.reviewLicenseeSubType.visible",
        true
      );
      dispatch(
        prepareFinalObject(
          "LicensesTemp[0].tradeLicenseDetail.tradeUnits[0].tradeType",
          tradeType.split(".")[0]
        )
      );
    } else {
      dispatch(
        prepareFinalObject(
          "LicensesTemp[0].tradeLicenseDetail.tradeUnits[0].tradeType",
          tradeType
        )
      );
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOwnerDetails.children.cardContent.children.multiOwner.children.viewFive.children.reviewLicenseeSubType.visible",
        false
      );
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.reviewOwnerDetails.children.cardContent.children.multiOwner.children.viewFive.children.reviewcounsilForArchNo.visible",
        false
      );
    }

    const status = get(
      state,
      "screenConfiguration.preparedFinalObject.Licenses[0].status"
    );

    let data = get(state, "screenConfiguration.preparedFinalObject");

    const obj = setStatusBasedValue(status);
    if (get(data, "Licenses[0].tradeLicenseDetail.applicationDocuments")) {
      await setDocuments(
        data,
        "Licenses[0].tradeLicenseDetail.applicationDocuments",
        "LicensesTemp[0].reviewDocData",
        dispatch
      );
    }
    // Get approval details based on status and set it in screenconfig

    if (
      status === "APPROVED" ||
      status === "REJECTED" ||
      status === "CANCELLED"
    ) {
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.approvalDetails.visible",
        true
      );

      if (get(data, "Licenses[0].tradeLicenseDetail.verificationDocuments")) {
        await setDocuments(
          data,
          "Licenses[0].tradeLicenseDetail.verificationDocuments",
          "LicensesTemp[0].verifyDocData",
          dispatch
        );
      } else {
        dispatch(
          handleField(
            "search-preview",
            "components.div.children.tradeReviewDetails.children.cardContent.children.approvalDetails.children.cardContent.children.viewTow.children.lbl",
            "visible",
            false
          )
        );
      }
    } else {
      set(
        action,
        "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.approvalDetails.visible",
        false
      );
    }

    const footer = footerReview(
      action,
      state,
      dispatch,
      status,
      applicationNumber,
      tenantId
    );
    process.env.REACT_APP_NAME === "Citizen"
      ? set(action, "screenConfig.components.div.children.footer", footer)
      : set(action, "screenConfig.components.div.children.footer", {});

    if (status === "cancelled")
      set(
        action,
        "screenConfig.components.div.children.headerDiv.children.helpSection.children.cancelledLabel.visible",
        true
      );

    if (status === "APPLIED" && process.env.REACT_APP_NAME === "Citizen") {
    }
    setActionItems(action, obj);
    // loadReceiptGenerationData(applicationNumber, tenantId);
    addressDestruct(action, state, dispatch);
  }

  let businessService = get(
    state,
    "screenConfiguration.preparedFinalObject.Licenses[0].tradeLicenseDetail.tradeUnits[0].tradeType"
  ).split(".")[0];

  const queryObject = [
    { key: "tenantId", value: tenantId },
    { key: "businessServices", value: businessService }
  ];
  setBusinessServiceDataToLocalStorage(queryObject, dispatch);
};

let titleText = "";

const setStatusBasedValue = status => {
  switch (status) {
    case "approved":
      return {
        titleText: "Review the stakeholder License",
        titleKey: "BPA_REVIEW_LICENSE",
        titleVisibility: true,
        roleDefination: {
          rolePath: "user-info.roles",
          roles: ["TL_APPROVER"]
        }
      };
    case "pending_payment":
      return {
        titleText: "Review the Application and Proceed",
        titleKey: "TL_REVIEW_APPLICATION_AND_PROCEED",
        titleVisibility: true,
        roleDefination: {
          rolePath: "user-info.roles",
          roles: ["TL_CEMP"]
        }
      };
    case "pending_approval":
      return {
        titleText: "Review the Application and Proceed",
        titleKey: "TL_REVIEW_APPLICATION_AND_PROCEED",
        titleVisibility: true,
        roleDefination: {
          rolePath: "user-info.roles",
          roles: ["TL_APPROVER"]
        }
      };
    case "cancelled":
      return {
        titleText: "",
        titleVisibility: false,
        roleDefination: {}
      };
    case "rejected":
      return {
        titleText: "",
        titleVisibility: false,
        roleDefination: {}
      };

    default:
      return {
        titleText: "",
        titleVisibility: false,
        roleDefination: {}
      };
  }
};

const headerrow = getCommonContainer({
  header: getCommonHeader({
    labelName: "Stakeholder Registration Application",
    labelKey: "BPA_REG_APPLICATION"
  }),
  applicationNumber: {
    uiFramework: "custom-atoms-local",
    moduleName: "egov-tradelicence",
    componentPath: "ApplicationNoContainer",
    props: {
      number: applicationNumber
    }
  }
});

const estimate = getCommonGrayCard({
  estimateSection: getFeesEstimateCard({
    sourceJsonPath: "LicensesTemp[0].estimateCardData"
  })
});

const reviewOrganizationDetails = getOrganizationDetails(false);

const reviewPermanentDetails = getPermanentDetails(false);
const reviewCommunicationDetails = getCommunicactionDetails(false);

const reviewOwnerDetails = getReviewOwner(false);

const reviewDocumentDetails = getReviewDocuments(false);

// let approvalDetails = getApprovalDetails(status);
let title = getCommonTitle({ labelName: titleText });

const setActionItems = (action, object) => {
  set(
    action,
    "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.title",
    getCommonTitle({
      labelName: get(object, "titleText"),
      labelKey: get(object, "titleKey")
    })
  );
  set(
    action,
    "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.title.visible",
    get(object, "titleVisibility")
  );
  set(
    action,
    "screenConfig.components.div.children.tradeReviewDetails.children.cardContent.children.title.roleDefination",
    get(object, "roleDefination")
  );
};

export const tradeReviewDetails = getCommonCard({
  title,
  estimate,
  reviewOwnerDetails,
  reviewOrganizationDetails,
  reviewPermanentDetails,
  reviewCommunicationDetails,
  reviewDocumentDetails
});

const screenConfig = {
  uiFramework: "material-ui",
  name: "search-preview",
  beforeInitScreen: (action, state, dispatch) => {
    const status = getQueryArg(window.location.href, "status");
    const tenantId = getQueryArg(window.location.href, "tenantId");
    applicationNumber = getQueryArg(window.location.href, "applicationNumber");
    //To set the application no. at the  top
    set(
      action.screenConfig,
      "components.div.children.headerDiv.children.header1.children.applicationNumber.props.number",
      applicationNumber
    );
    if (status !== "pending_payment") {
      set(
        action.screenConfig,
        "components.div.children.tradeReviewDetails.children.cardContent.children.viewBreakupButton.visible",
        false
      );
    }
    beforeInitFn(action, state, dispatch, applicationNumber);

    return action;
  },

  components: {
    div: {
      uiFramework: "custom-atoms",
      componentPath: "Div",
      props: {
        className: "common-div-css search-preview"
      },
      children: {
        headerDiv: {
          uiFramework: "custom-atoms",
          componentPath: "Container",
          children: {
            header1: {
              gridDefination: {
                xs: 12,
                sm: 8
              },
              ...headerrow
            },
            helpSection: {
              uiFramework: "custom-atoms",
              componentPath: "Container",
              props: {
                color: "primary",
                style: { justifyContent: "flex-end", display: "block" }
              },
              gridDefination: {
                xs: 12,
                sm: 4,
                align: "right"
              },
              children:
                process.env.REACT_APP_NAME === "Employee"
                  ? {}
                  : {
                      word1: {
                        ...getCommonTitle(
                          {
                            jsonPath: "Licenses[0].headerSideText.word1"
                          },
                          {
                            style: {
                              marginRight: "10px",
                              color: "rgba(0, 0, 0, 0.6000000238418579)"
                            }
                          }
                        )
                      },
                      word2: {
                        ...getCommonTitle({
                          jsonPath: "Licenses[0].headerSideText.word2"
                        })
                      },
                      cancelledLabel: {
                        ...getCommonHeader(
                          {
                            labelName: "Cancelled",
                            labelKey: "TL_COMMON_STATUS_CANC"
                          },
                          { variant: "body1", style: { color: "#E54D42" } }
                        ),
                        visible: false
                      }
                    }
            }
          }
        },
        taskStatus: {
          uiFramework: "custom-containers-local",
          componentPath: "WorkFlowContainer",
          moduleName: "egov-workflow",
          visible: process.env.REACT_APP_NAME === "Citizen" ? false : true,
          props: {
            dataPath: "Licenses",
            updateUrl: "/tl-services/v1/BPAREG/_update"
          }
        },
        tradeReviewDetails
        //footer
      }
    },
    breakUpDialog: {
      uiFramework: "custom-containers-local",
      moduleName: "egov-tradelicence",
      componentPath: "ViewBreakupContainer",
      props: {
        open: false,
        maxWidth: "md",
        screenKey: "search-preview"
      }
    }
  }
};

export default screenConfig;
