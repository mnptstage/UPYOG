package org.egov.notice.service;

import org.egov.notice.config.NoticeConfiguration;
import org.egov.notice.enums.NoticeType;
import org.egov.notice.producer.NoticeProducer;
import org.egov.notice.util.CommonUtils;
import org.egov.notice.web.model.Notice;
import org.egov.notice.web.model.NoticeRequest;
import org.egov.notice.web.model.NoticeResponse;
import org.egov.tracer.model.CustomException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.cedarsoftware.util.StringUtilities;

import java.util.ArrayList;
import java.util.List;

import org.egov.common.contract.request.RequestInfo;


@Service
public class NoticeService {
	
	@Autowired
	EnrichmentService enrichmentService;
	
	@Autowired
	NoticeProducer noticeProducer;
	
	@Autowired
	NoticeConfiguration noticeconfig;
	
	public NoticeResponse saveNoticeData(NoticeRequest noticeRequest)
	{
		NoticeResponse response = null;
		Notice noticeFromRequest = noticeRequest.getNotice();
		if(noticeFromRequest.getNoticeType().equals(NoticeType.REC_MIS_DEF_RET))
		{
			validateForRecMistakeDefectiveReturn(noticeFromRequest);
			enrichmentService.enrichCreateRequest(noticeFromRequest,noticeRequest.getRequestInfo());
			noticeRequest.setNotice(noticeFromRequest);
			System.out.println("noticeFromRequest::"+noticeFromRequest);
			noticeProducer.push(noticeconfig.getSavenoticetopic(), noticeRequest);
			
		}
		List<Notice> noticresponse=new ArrayList<Notice>();
		response=new NoticeResponse();
		noticresponse.add(noticeFromRequest);
		response.setNotice(noticresponse);
		//noticeProducer.push(noticeconfig.getSavenoticetopic(), response);
		return response;
	}

	private void validateForRecMistakeDefectiveReturn(Notice noticeFromRequest) {
		if(StringUtilities.isEmpty(noticeFromRequest.getAcknowledgementNumber())) {
			throw new CustomException("INVALID_ACK_NUM", "Invalid Acknowledgement Number");
			
		}
		if(StringUtilities.isEmpty(noticeFromRequest.getAssessmentYear())) {
			throw new CustomException("INVALID_ASMT_YEAR", "Invalid Assessment Year");
			
		}	
		
		if(StringUtilities.isEmpty(noticeFromRequest.getPropertyId())) {
			throw new CustomException("INVALID_PROP_NUM", "Invalid Property Id or UPIN");
			
		}
		
		
		
		
	}

}
